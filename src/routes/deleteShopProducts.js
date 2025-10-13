import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * DELETE /delete-all-products
 * Deletes all products from the connected Shopify store
 *
 * Environment variables required:
 *   - SHOPIFY_STORE_DOMAIN
 *   - SHOPIFY_ADMIN_TOKEN
 */
router.delete("/delete-all-products", async (req, res) => {
  try {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN } = process.env;

    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(400).json({
        error: "Missing Shopify credentials in .env file.",
      });
    }

    const baseUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07/products.json`;
    let deletedCount = 0;
    let hasNextPage = true;
    let pageInfo = null;

    // Axios instance for reuse
    const shopify = axios.create({
      baseURL: `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07`,
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    console.log("🚀 Starting product deletion from Shopify...");

    while (hasNextPage) {
      const url = pageInfo ? `/products.json?limit=250&page_info=${pageInfo}` : `/products.json?limit=250`;

      const { data, headers } = await shopify.get(url);
      const products = data.products || [];

      if (products.length === 0) {
        hasNextPage = false;
        break;
      }

      console.log(`🔍 Found ${products.length} products in this batch.`);

      for (const product of products) {
        try {
          await shopify.delete(`/products/${product.id}.json`);
          deletedCount++;
          console.log(`✅ Deleted: ${product.title} (ID: ${product.id})`);
        } catch (deleteError) {
          console.warn(
            `⚠️ Failed to delete product ID: ${product.id}`,
            deleteError.response?.data || deleteError.message
          );
        }

        // Shopify allows 2 requests/sec safely
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Handle pagination
      const linkHeader = headers.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^&>]+)/);
        pageInfo = match ? match[1] : null;
      } else {
        hasNextPage = false;
      }
    }

    console.log(`🧹 Completed deletion: ${deletedCount} products removed.`);
    res.json({
      success: true,
      message: `Deleted ${deletedCount} products successfully.`,
    });
  } catch (err) {
    console.error("❌ Error deleting products:", err);
    res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});

export default router;
