import express from 'express';
import { Product } from "../models/Product.js";

const router = express.Router();

// GET all products (with optional query filter)
router.get('/products', async (req, res) => {
  try {
    const { vendor, keyword } = req.query;
    const filter = {};

    if (vendor) filter.vendor = new RegExp(vendor, 'i');
    if (keyword) filter.title = new RegExp(keyword, 'i');

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
