
import axios from "axios";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-07";

function assertShopifyEnv() {
  if (!SHOPIFY_STORE || !SHOPIFY_ADMIN_TOKEN) {
    throw new Error("Missing Shopify credentials in .env");
  }
}

export async function shopifyGraphQL(query, variables = {}) {
  assertShopifyEnv();
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN
  };
  const res = await axios.post(url, { query, variables }, { headers });
  if (res.data.errors) {
    throw new Error("GraphQL errors: " + JSON.stringify(res.data.errors, null, 2));
  }
  return res.data.data;
}

export async function createShopifyProductAndVariant(p) {
  // --- [1] Create Product ---
  const productCreateMutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product { id title handle status }
        userErrors { field message }
      }
    }
  `;

  const productVariables = {
    input: {
      title: p.title || "Untitled Product",
      descriptionHtml: `
        <p><strong>${p.vendor || ""}</strong></p>
        ${p.longDesc || "<p>No description available.</p>"}
        ${p.attributes ? `<p><b>Attributes:</b> ${p.attributes}</p>` : ""}
        ${p.dimensions ? `<p><b>Dimensions:</b> ${p.dimensions}</p>` : ""}
        ${p.weight ? `<p><b>Weight:</b> ${p.weight}</p>` : ""}
        ${p.warranty ? `<p><b>Warranty:</b> ${p.warranty}</p>` : ""}
        ${p.warning ? `<p><b>Warning:</b> ${p.warning}</p>` : ""}
      `,
      vendor: p.vendor || "Unknown",
      productType: p.productType || "Brake Components",
      tags: [
        "PIES",
        p.vendor || "unknown",
        ...(p.tags || [])
      ],
      status: "ACTIVE",
      images: (p.images || []).map((uri) => ({ src: uri }))
    }
  };

  const productData = await shopifyGraphQL(productCreateMutation, productVariables);
  const product = productData?.productCreate?.product;
  const pErrs = productData?.productCreate?.userErrors;

  if (!product || (pErrs && pErrs.length)) {
    console.error("Shopify productCreate failed:", JSON.stringify(pErrs, null, 2));
    throw new Error("❌ Failed to create product");
  }

  console.log(`✅ Product created: ${product.title} (${product.id})`);

  // --- [2] Create Variant ---
  const variantMutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          inventoryItem { sku tracked }
        }
        userErrors { field message }
      }
    }
  `;

  const variantInput = [
    {
      title: p.variantTitle || "Default",
      price: String(p.price || "99.99"),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : undefined,
      inventoryQuantity: p.inventory || 10,
      inventoryItem: {
        sku: p.sku || `AUTO-${Math.floor(Math.random() * 999999)}`,
        tracked: true
      },
      weight: p.weightValue || 15.0,
      weightUnit: p.weightUnit || "POUNDS",
      requiresShipping: true
    }
  ];

  const variantVariables = {
    productId: product.id,
    variants: variantInput
  };

  const vData = await shopifyGraphQL(variantMutation, variantVariables);
  const vErrs = vData?.productVariantsBulkCreate?.userErrors;

  if (vErrs && vErrs.length) {
    console.error("Shopify productVariantsBulkCreate failed:", JSON.stringify(vErrs, null, 2));
    throw new Error("❌ Failed to create variant(s)");
  }

  console.log(`✅ Variant created for ${p.sku || product.title}`);

  // --- [3] Return success object ---
  return {
    success: true,
    productId: product.id,
    productHandle: product.handle,
    variantCount: variantInput.length
  };
}
