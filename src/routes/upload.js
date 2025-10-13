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
    console.log(`Parsed ${parsedProducts.length} products from PIES`);

    // Upsert to DB by SKU
    const results = [];
    for (const p of parsedProducts) {
      if (!p.sku) continue;
      const update = { $set: p };
      const saved = await Product.findOneAndUpdate({ sku: p.sku }, update, {
        new: true, upsert: true, setDefaultsOnInsert: true
      });
      results.push(saved);

      // optionally push to Shopify (sequential to respect rate limits)
      if (syncToShopify) {
        try {
          await createShopifyProductAndVariant(p);
        } catch (e) {
          console.warn(`⚠️ Shopify sync failed for SKU ${p.sku}:`, e.message);
        }
      }
    }

    // delete the uploaded file
    fs.unlink(filePath, () => {});

    res.json({
      status: "ok",
      stored: results.length,
      sample: parsedProducts.slice(0, 1)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
