import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import uploadRoutes from "./routes/upload.js";
import searchRoutes from "./routes/search.js";
import deleteShopProducts from "./routes/deleteShopProducts.js"
import syncShopify from "./routes/syncShopify.js"
import productRoutes from './routes/productRoutes.js';
import acesRoutes from './routes/acesRoutes.js';

dotenv.config();
const app = express();

// core middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// db
await connectDB();

app.use('/', productRoutes);
// routes
app.use(uploadRoutes);
// fillter all the prodcuts
app.use(searchRoutes);
// delete all products
app.use("/", deleteShopProducts);
//sync to shopify
app.use("/",syncShopify)
// aces upload
app.use("/", acesRoutes)
// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// global error handler (last)
app.use((err, req, res, next) => {
  console.error("🚨 Unhandled Error:", err);
  res.status(500).json({ error: err.message || "Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
