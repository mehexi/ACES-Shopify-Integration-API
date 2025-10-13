import express from "express";
import axios from "axios";
import { Product } from "../models/Product.js";

const router = express.Router();

/**
 * POST /sync-shopify
 * Synchronizes MongoDB-stored products with Shopify
 *
 * Requires:
 *   - SHOPIFY_STORE_DOMAIN
 *   - SHOPIFY_ADMIN_TOKEN
 */
router.post("/sync-shopify", async (req, res) => {
  try {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN } = process.env;

    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(400).json({ error: "Missing Shopify credentials in .env" });
    }

    // 1️⃣ Fetch products from MongoDB that are not yet synced
    const unsyncedProducts = await Product.find({ synced: { $ne: true } });

    if (!unsyncedProducts.length) {
      return res.status(200).json({ message: "No unsynced products found." });
    }

    console.log(`🔄 Found ${unsyncedProducts.length} products to sync.`);

    // 2️⃣ Create an Axios instance for Shopify API
    const shopify = axios.create({
      baseURL: `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07`,
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const results = [];

    // 3️⃣ Loop through each unsynced product
    for (const p of unsyncedProducts) {
      try {
        // Prepare product data for Shopify
        const productData = {
          product: {
            title: p.title || "Untitled Product",
            body_html: p.longDesc || p.shortDesc || "",
            vendor: p.vendor || "Unknown Vendor",
            product_type: "Auto Parts",
            tags: ["PIES"],
            status: "active",
            variants: [
              {
                sku: p.sku,
                price: "99.99", // default, replace if you have a price field
                inventory_management: "SHOPIFY",
                inventory_quantity: 10,
              },
            ],
            images: p.images?.length
              ? p.images.map(img => ({
                  src: img.startsWith("http")
                    ? img
                    : `https://your-cdn-domain.com/${img}`, // optional CDN URL
                }))
              : [],
          },
        };

        // 4️⃣ Create product in Shopify
        const response = await shopify.post("/products.json", productData);
        const shopifyProduct = response.data.product;

        // 5️⃣ Update MongoDB to mark as synced
        p.synced = true;
        p.shopifyId = shopifyProduct.id;
        await p.save();

        console.log(`✅ Synced: ${p.title} (${p.sku}) → Shopify ID: ${shopifyProduct.id}`);

        results.push({
          title: p.title,
          sku: p.sku,
          shopifyId: shopifyProduct.id,
        });

        // Respect rate limits (max 2 requests/sec)
        await new Promise(resolve => setTimeout(resolve, 5));
      } catch (err) {
        console.error(`❌ Failed to sync ${p.title || p.sku}:`, err.response?.data || err.message);
        results.push({
          title: p.title,
          sku: p.sku,
          error: err.response?.data?.errors || err.message,
        });
      }
    }

    res.json({
      success: true,
      syncedCount: results.filter(r => r.shopifyId).length,
      failedCount: results.filter(r => r.error).length,
      results,
    });
  } catch (err) {
    console.error("❌ Sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
