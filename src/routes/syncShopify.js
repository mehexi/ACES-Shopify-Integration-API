import { Router } from "express";
import axios from "axios";
import { Product } from "../models/Product.js";

const router = Router();

router.post("/sync-shopify", async (req, res) => {
  try {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN } = process.env;

    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(400).json({ error: "Missing Shopify credentials in .env" });
    }

    // 1️⃣ Fetch unsynced products
    const unsyncedProducts = await Product.find({ synced: { $ne: true } });
    const total = unsyncedProducts.length;

    if (!total) {
      return res.status(200).json({ message: "No unsynced products found." });
    }

    console.log(`🔄 Found ${total} products to sync to Shopify.`);

    // 2️⃣ Shopify API client
    const shopify = axios.create({
      baseURL: `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-07`,
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    // 3️⃣ Sync process
    const results = [];
    let index = 0;
    let successCount = 0;
    let failCount = 0;

    for (const p of unsyncedProducts) {
      index++;
      console.log(`🚀 [${index}/${total}] Uploading: ${p.title || p.sku}`);

      try {
        // Normalize pricing object (handle Mongoose subdocs)
        const pricing = p.pricing?.toObject ? p.pricing.toObject() : p.pricing || {};

        // Use nullish coalescing to safely select price
// Normalize Mongoose Map or Object pricing
let finalPrice = 0;
if (p.pricing instanceof Map) {
  // Handle Map type
  finalPrice =
    p.pricing.get("MAP") ??
    p.pricing.get("RMP") ??
    p.pricing.get("DLR") ??
    p.pricing.get("MSRP") ??
    0.0;
} else if (typeof p.pricing === "object" && p.pricing !== null) {
  // Handle plain object type
  finalPrice =
    p.pricing.MAP ??
    p.pricing.RMP ??
    p.pricing.DLR ??
    p.pricing.MSRP ??
    0.0;
}
        if (!finalPrice) {
          console.warn(`⚠️ Skipping ${p.sku}: missing valid price.`);
          results.push({
            title: p.title,
            sku: p.sku,
            error: "Missing valid price — skipped",
          });
          continue; // skip this product
        }

        const productData = {
          product: {
            title: p.title || "Untitled Product",
            body_html: p.longDesc || p.shortDesc || "",
            vendor: p.vendor || "Unknown Vendor",
            product_type: p.category || "Auto Parts",
            tags: [
              "PIES",
              p.category,
              p.subcategory,
              p.piesSegment,
              p.piesBase,
              p.piesSub,
              p.attributes?.position,
              p.attributes?.material,
            ].filter(Boolean),
            status: "active",
            variants: [
              {
                sku: p.sku,
                price: finalPrice,
                inventory_management: "SHOPIFY",
                inventory_quantity: p.qtyAvailable || 10,
              },
            ],
            images: p.images?.length
              ? p.images.map((img) => ({
                  src: img.startsWith("http")
                    ? img
                    : `https://your-cdn-domain.com/${img}`,
                }))
              : [],
          },
        };

        // 4️⃣ Create product in Shopify
        const response = await shopify.post("/products.json", productData);
        const shopifyProduct = response.data.product;

        // 5️⃣ Update DB
        p.synced = true;
        p.shopifyId = shopifyProduct.id;
        await p.save();

        successCount++;
        console.log(
          `✅ [${index}/${total}] Synced: ${p.title} → Shopify ID ${shopifyProduct.id}`
        );

        results.push({
          title: p.title,
          sku: p.sku,
          shopifyId: shopifyProduct.id,
        });

        // 🕐 Delay to respect Shopify’s API rate limits
        await new Promise((resolve) => setTimeout(resolve, 100)); // 2 req/sec
      } catch (err) {
        failCount++;
        const errorMsg = err.response?.data?.errors || err.message;
        console.error(`❌ [${index}/${total}] Failed: ${p.title || p.sku} →`, errorMsg);

        results.push({
          title: p.title,
          sku: p.sku,
          error: errorMsg,
        });
      }
    }

    // 6️⃣ Summary response
    res.json({
      success: true,
      total,
      syncedCount: successCount,
      failedCount: failCount,
      message: `✅ Shopify sync completed (${successCount}/${total} successful)`,
      results,
    });
  } catch (err) {
    console.error("❌ Sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
