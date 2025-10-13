
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
  // 1) productCreate (ProductInput; no options)
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
        <p><strong>${p.vendor || ""}</strong></p>
        ${p.longDesc || "<p>No description available</p>"}
        ${p.attributes ? `<p><b>Attributes:</b> ${p.attributes}</p>` : ""}
        ${p.dimensions ? `<p><b>Dimensions:</b> ${p.dimensions}</p>` : ""}
        ${p.weight ? `<p><b>Weight:</b> ${p.weight}</p>` : ""}
      `,
      vendor: p.vendor || "Unknown",
      productType: "Brake Components",
      tags: ["PIES", p.vendor || "unknown"],
      status: "ACTIVE"
    }
  };

  const productData = await shopifyGraphQL(productCreateMutation, productVariables);
  const product = productData.productCreate?.product;
  const uerrs = productData.productCreate?.userErrors;
  if (!product || (uerrs && uerrs.length)) {
    throw new Error("Shopify productCreate failed: " + JSON.stringify(uerrs, null, 2));
  }

  // 2) productVariantsBulkCreate (no requiresShipping; inventoryItem.sku, tracked)
  const variantMutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id price inventoryItem { sku tracked } }
        userErrors { field message }
      }
    }
  `;

  const variantVariables = {
    productId: product.id,
    variants: [
      {
        price: "99.99",
        inventoryItem: {
          sku: p.sku || `AUTO-${Math.floor(Math.random() * 999999)}`,
          tracked: true
        }
      }
    ]
  };

  const vData = await shopifyGraphQL(variantMutation, variantVariables);
  const vErrs = vData.productVariantsBulkCreate?.userErrors;
  if (vErrs && vErrs.length) {
    throw new Error("Shopify productVariantsBulkCreate failed: " + JSON.stringify(vErrs, null, 2));
  }

  return product;
}
