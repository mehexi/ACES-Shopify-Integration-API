import express from "express";
import multer from "multer";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer();

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2024-07";

//----------------------------------------------------------
// 🔧 Shopify GraphQL helper
//----------------------------------------------------------
async function shopifyGraphQL(query, variables = {}) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
  };

  const res = await axios.post(url, { query, variables }, { headers });

  if (res.data.errors) {
    console.error("GraphQL errors:", JSON.stringify(res.data.errors, null, 2));
    throw new Error(JSON.stringify(res.data.errors, null, 2));
  }
  return res.data.data;
}

//----------------------------------------------------------
// 🧩 PIES XML Parser
//----------------------------------------------------------
async function parsePies(xmlBuffer) {
  const xml = xmlBuffer.toString("utf8");
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  const pies = parsed.PIES || {};
  const items = pies.Items?.Item || [];
  const result = [];

  const itemArray = Array.isArray(items) ? items : [items];

  for (const item of itemArray) {
    if (!item) continue;

    const partNumber = item.PartNumber || "";
    const baseId = item.BaseItemID || "";
    const brand = item.BrandLabel || "Unknown Brand";

    const descs = item.Descriptions?.Description || [];
    const descArray = Array.isArray(descs) ? descs : [descs];

    const title =
      descArray.find((d) => d.DescriptionCode === "TLE")?._ ||
      partNumber;

    let shortDesc = "";
    let longDesc = "";
    for (const d of descArray) {
      if (d.DescriptionCode === "SHO") shortDesc = d._ || d;
      if (d.DescriptionCode === "EXT") longDesc += `<p>${d._ || d}</p>\n`;
    }

    const attributes = item.ProductAttributes?.ProductAttribute || [];
    const attrArray = Array.isArray(attributes) ? attributes : [attributes];
    const attributeText = attrArray
      .map((a) => `${a.AttributeID}: ${a._}`)
      .join(", ");

    const pkg = item.Packages?.Package || {};
    const dims = pkg.Dimensions || {};
    const weights = pkg.Weights || {};
    const height = dims.ShippingHeight || "";
    const width = dims.ShippingWidth || "";
    const length = dims.ShippingLength || "";
    const weight = weights.Weight || "";

    const digitalAssets = item.DigitalAssets?.DigitalFileInformation || [];
    const assetArray = Array.isArray(digitalAssets)
      ? digitalAssets
      : [digitalAssets];
    const images = assetArray.map((a) => a.FileName).filter(Boolean);

    result.push({
      title: title || `Part ${partNumber}`,
      sku: partNumber || baseId,
      vendor: brand,
      shortDesc,
      longDesc,
      attributes: attributeText,
      weight,
      dimensions: `${length}x${width}x${height}`,
      images,
    });
  }

  return result;
}

//----------------------------------------------------------
// 🏷️ Shopify Product Creation
//----------------------------------------------------------
async function createShopifyProduct(p) {
  const productCreateMutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product { id title handle }
        userErrors { field message }
      }
    }
  `;

  const productVariables = {
    input: {
      title: p.title,
      descriptionHtml: `
        <p><strong>${p.vendor}</strong></p>
        ${p.longDesc || "<p>No description available</p>"}
        <p><b>Attributes:</b> ${p.attributes}</p>
        <p><b>Dimensions:</b> ${p.dimensions}</p>
        <p><b>Weight:</b> ${p.weight} lbs</p>
      `,
      vendor: p.vendor,
      productType: "Brake Components",
      tags: ["PIES", p.vendor],
      status: "ACTIVE",
    },
  };

  const productData = await shopifyGraphQL(productCreateMutation, productVariables);
  const product = productData.productCreate?.product;
  if (!product) throw new Error("Product creation failed.");

  console.log(`✅ Created product: ${product.title} (${product.id})`);

  // Variant creation
  const variantMutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id inventoryItem { sku } price }
        userErrors { field message }
      }
    }
  `;

  const variantVariables = {
    productId: product.id,
    variants: [
      {
        price: "99.99",
        inventoryItem: { sku: p.sku, tracked: true },
      },
    ],
  };

  await shopifyGraphQL(variantMutation, variantVariables);
  console.log(`✅ Variant added for SKU: ${p.sku}`);

  return product;
}

//----------------------------------------------------------
// 🗃 In-memory storage for parsed PIES products
//----------------------------------------------------------
let cachedProducts = [];

//----------------------------------------------------------
// 📦 /upload → handle PIES file upload
//----------------------------------------------------------
app.post("/upload", upload.fields([{ name: "pies" }]), async (req, res) => {
  try {
    const piesFile = req.files?.pies?.[0];
    if (!piesFile) return res.status(400).json({ error: "No PIES file uploaded" });

    const parsedProducts = await parsePies(piesFile.buffer);
    console.log(`Parsed ${parsedProducts.length} products from PIES`);

    // ✅ cache products in memory for search
    cachedProducts = parsedProducts;

    const created = [];
    for (const p of parsedProducts) {
      const product = await createShopifyProduct(p);
      created.push(product);
    }

    res.json({
      status: "ok",
      uploaded: created.length,
      sample: parsedProducts.slice(0, 1),
    });
  } catch (err) {
    console.error("❌ Upload Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

//----------------------------------------------------------
// 🔍 /search-ace?make=1998&brand=toyota
//----------------------------------------------------------
app.get("/search-ace", async (req, res) => {
  try {
    const { make, brand, model, year, part } = req.query;

    if (cachedProducts.length === 0) {
      return res.status(404).json({
        error: "No PIES data available. Please upload PIES file first via /upload.",
      });
    }

    let results = cachedProducts;

    if (brand) {
      results = results.filter((p) =>
        p.vendor?.toLowerCase().includes(brand.toLowerCase())
      );
    }

    if (part) {
      results = results.filter((p) =>
        p.sku?.toLowerCase().includes(part.toLowerCase())
      );
    }

    if (model) {
      results = results.filter((p) =>
        p.title?.toLowerCase().includes(model.toLowerCase())
      );
    }

    if (year || make) {
      const y = (year || make).toString();
      results = results.filter((p) =>
        p.title?.toLowerCase().includes(y.toLowerCase())
      );
    }

    res.json({
      status: "ok",
      total: results.length,
      filters: { make, brand, model, year, part },
      results,
    });
  } catch (err) {
    console.error("❌ Search Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

//----------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
