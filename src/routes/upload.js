import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { parsePies } from "../utils/parsePies.js";
import { Product } from "../models/Product.js";
import { createShopifyProductAndVariant } from "../utils/shopify.js";

const router = Router();

// disk storage for uploads
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".xml";
    cb(null, `pies_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// POST /upload (PIES)
// form-data key: pies (file)
router.post("/upload", upload.single("pies"), async (req, res, next) => {
  const syncToShopify = (process.env.SYNC_TO_SHOPIFY || "false").toLowerCase() === "true";

  try {
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ error: "No PIES file uploaded" });

    const xmlBuffer = fs.readFileSync(filePath);
    const parsedProducts = await parsePies(xmlBuffer);
    console.log(`📦 Parsed ${parsedProducts.length} products from PIES file.`);

    const total = parsedProducts.length;
    let uploaded = 0;

    const results = [];

    for (let i = 0; i < total; i++) {
      const p = parsedProducts[i];
      if (!p.sku) continue;

      // Log progress before upload
      console.log(`🚀 Uploading to Shopify: ${i + 1} / ${total} → ${p.sku}`);
      // Save to DB
      const saved = await Product.findOneAndUpdate(
        { sku: p.sku },
        { $set: p },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push(saved);

      // Shopify upload
      if (syncToShopify) {
        try {
          const result = await createShopifyProductAndVariant(p);
          uploaded++;
          console.log(`✅ Uploaded ${uploaded}/${total}: ${p.sku} (${result.productHandle})`);
        } catch (err) {
          console.warn(`⚠️ Shopify sync failed for SKU ${p.sku}:`, err.message);
        }
      }
    }

    // cleanup
    fs.unlink(filePath, () => {});

    res.json({
      status: "ok",
      parsed: total,
      uploaded: uploaded,
      stored: results.length,
      message: `✅ Upload completed (${uploaded}/${total})`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
