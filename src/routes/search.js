import { Router } from "express";
import { Product } from "../models/Product.js";
import { Ace } from "../models/Ace.js";

const router = Router();

// GET /search-ace?make=1998&brand=toyota&model=camry&part=C47&page=1&limit=20
router.get("/search-ace", async (req, res) => {
  try {
    const {
      brand,
      part,
      title,
      make,
      model,
      year,
      page = "1",
      limit = "10",
      sort = "createdAt:desc",
    } = req.query;

    const pageNum  = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;

    // ---------- 1) Resolve SKUs via ACES (if any Y/M/M constraints) ----------
    let skuConstraint = null;

    // Build ACES filter only if any of make/model/year was provided
    if (make || model || year) {
      const aceFilter = {};
      if (make)  aceFilter.makeId  = make;           // you store ids as strings
      if (model) aceFilter.modelId = model;

      if (year) {
        const y = parseInt(year, 10);
        if (!Number.isNaN(y)) {
          // ACES range match: yearFrom <= y <= yearTo
          aceFilter.yearFrom = { $lte: String(y) };   // your DB shows yearFrom/yearTo stored as strings
          aceFilter.yearTo   = { $gte: String(y) };
        }
      }

      // distinct is cheap and returns a flat array of SKUs
      const matchingSkus = await Ace.distinct("sku", aceFilter);

      // If we asked for Y/M/M but nothing matched, return early.
      if (!matchingSkus.length) {
        return res.json({
          query: req.query,
          total: 0,
          page: pageNum,
          limit: limitNum,
          products: [],
        });
      }
      skuConstraint = matchingSkus;
    }

    // ---------- 2) Build Product filter ----------
    const productFilter = {};
    if (skuConstraint) {
      productFilter.sku = { $in: skuConstraint };
    }
    if (brand) {
      productFilter.vendor = { $regex: brand, $options: "i" };
    }
    if (part) {
      productFilter.sku = productFilter.sku
        ? { $in: skuConstraint.filter(s => new RegExp(part, "i").test(s)) }
        : { $regex: part, $options: "i" };
    }
    if (title) {
      productFilter.title = { $regex: title, $options: "i" };
    }

    // ---------- 3) Sorting ----------
    // sort format: "field:dir", e.g. "title:asc" or "createdAt:desc"
    const [sortFieldRaw, sortDirRaw] = String(sort).split(":");
    const sortField = sortFieldRaw && sortFieldRaw.trim() ? sortFieldRaw.trim() : "createdAt";
    const sortDir   = (sortDirRaw || "desc").toLowerCase() === "asc" ? 1 : -1;
    const sortSpec  = { [sortField]: sortDir };

    // ---------- 4) Query & paginate ----------
    const [products, total] = await Promise.all([
      Product.find(productFilter).sort(sortSpec).skip(skip).limit(limitNum),
      Product.countDocuments(productFilter),
    ]);

    res.json({
      query: req.query,
      filterUsed: productFilter,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: skip + products.length < total,
      products: products.map(p => ({
        id: p._id,
        title: p.title,
        sku: p.sku,
        vendor: p.vendor,
        description: p.shortDesc,
        weight: p.weight,
        attributes: p.attributes,
        dimensions: p.dimensions,
        image: Array.isArray(p.images) ? p.images[0] || null : null,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ /search-ace error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.get("/search-ace/options", async (req, res) => {
  try {
    // Get distinct values from actual DB fields
    const [makes, models, yearsFrom, yearsTo] = await Promise.all([
      Ace.distinct("makeId"),
      Ace.distinct("modelId"),
      Ace.distinct("yearFrom"),
      Ace.distinct("yearTo")
    ]);

    // Helper to clean arrays
    const clean = (arr) => arr.filter(Boolean).sort();

    res.json({
      makes: clean(makes),
      models: clean(models),
      yearsFrom: clean(yearsFrom),
      yearTo: clean(yearsTo)
    });
  } catch (err) {
    console.error("❌ /search-ace/options error:", err.message);
    res.status(500).json({ error: "Failed to fetch dropdown options" });
  }
});

export default router;
