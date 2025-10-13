import { Router } from "express";
import { Product } from "../models/Product.js";

const router = Router();

// GET /search-ace?make=1998&brand=toyota&model=camry&part=C47&page=1&limit=20
router.get("/search-ace", async (req, res) => {
  try {
    const { brand, part, make, model, year, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Brand filter
    if (brand) {
      filter.vendor = { $regex: brand, $options: "i" };
    }

    // Part number filter (exact or partial)
    if (part) {
      filter.sku = { $regex: part, $options: "i" };
    }

    // Vehicle-based filters (if ACES data is linked)
    if (make) {
      filter["vehicle.make"] = { $regex: make, $options: "i" };
    }
    if (model) {
      filter["vehicle.model"] = { $regex: model, $options: "i" };
    }
    if (year) {
      // Year can be numeric or range (e.g., 2010–2015)
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        filter.$or = [
          { "vehicle.yearFrom": { $lte: yearNum }, "vehicle.yearTo": { $gte: yearNum } },
          { "vehicle.years": yearNum }
        ];
      }
    }

    // Pagination
    const skip = (page - 1) * limit;
    const products = await Product.find(filter).skip(skip).limit(parseInt(limit, 10));

    res.json({
      query: req.query,
      total: products.length,
      filterUsed: filter,
      products: products.map(p => ({
        id: p._id,
        title: p.title,
        sku: p.sku,
        vendor: p.vendor,
        description: p.shortDesc,
        weight: p.weight,
        attributes: p.attributes,
        dimensions: p.dimensions,
        image: p.images?.[0] || null
      }))
    });

  } catch (err) {
    console.error("❌ /search-ace error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
