import { Router } from "express";
import multer from "multer";
import { parseStringPromise } from "xml2js";
import { Ace } from "../models/Ace.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /upload-aces
 * Upload JSON payload of ACE entries
 */
router.post("/upload-aces", async (req, res) => {
  try {
    const { aces } = req.body;
    if (!aces || !Array.isArray(aces)) {
      return res.status(400).json({ error: 'Invalid or missing "aces" array' });
    }

    const inserted = [];
    const skipped = [];

    for (const item of aces) {
      const { sku, yearFrom, yearTo, makeId, modelId, partTypeId, positionId } = item;
      if (!sku || !yearFrom || !yearTo || !makeId || !modelId) continue;

      const exists = await Ace.findOne({ sku, yearFrom, yearTo, makeId, modelId });
      if (!exists) {
        const ace = new Ace({ sku, yearFrom, yearTo, makeId, modelId, partTypeId, positionId });
        await ace.save();
        inserted.push(ace);
      } else {
        skipped.push(sku);
      }
    }

    res.json({
      message: `✅ Uploaded ${inserted.length}. Skipped ${skipped.length}.`,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
    });
  } catch (err) {
    console.error("❌ /upload-aces error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /upload-aces-xml
 * Accepts ACES XML file, parse, insert unique
 */
router.post("/upload-aces-xml", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    const xml = req.file.buffer.toString();
    const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

    const apps = parsed.ACES?.App;
    if (!apps) {
      return res.status(400).json({ error: "Invalid ACES XML: missing App nodes." });
    }
    const arr = Array.isArray(apps) ? apps : [apps];
    const inserted = [];
    const skipped = [];

    for (const app of arr) {
      const sku = app.Part;
      const years = app.Years || {};
      const makeId = app.Make?.id;
      const modelId = app.Model?.id;
      const partTypeId = app.PartType?.id || null;
      const positionId = app.Position?.id || null;

      if (!sku || !makeId || !modelId || !years.from || !years.to) continue;

      const exists = await Ace.findOne({
        sku,
        yearFrom: years.from,
        yearTo: years.to,
        makeId,
        modelId,
      });
      if (!exists) {
        const ace = new Ace({
          sku,
          yearFrom: years.from,
          yearTo: years.to,
          makeId,
          modelId,
          partTypeId,
          positionId,
        });
        await ace.save();
        inserted.push(ace);
      } else {
        skipped.push(sku);
      }
    }

    res.json({
      message: `Parsed ${arr.length} apps. Inserted ${inserted.length}, skipped ${skipped.length}.`,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
    });
  } catch (err) {
    console.error("❌ /upload-aces-xml error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /upload-aces
 * Filter & paginate ACE records
 */
router.get("/upload-aces", async (req, res) => {
  try {
    const { sku, makeId, modelId, yearFrom, yearTo, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (sku) filter.sku = { $regex: sku, $options: "i" };
    if (makeId) filter.makeId = makeId;
    if (modelId) filter.modelId = modelId;
    if (yearFrom) filter.yearFrom = yearFrom;
    if (yearTo) filter.yearTo = yearTo;

    const skip = (page - 1) * limit;
    const aces = await Ace.find(filter).skip(skip).limit(parseInt(limit, 10));
    const total = await Ace.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filterUsed: filter,
      results: aces,
    });
  } catch (err) {
    console.error("❌ /upload-aces (GET) error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
