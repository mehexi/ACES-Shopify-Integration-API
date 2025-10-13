import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, index: true },
    sku: { type: String, index: true, unique: true, sparse: true },
    vendor: { type: String, index: true },
    attributes: String,
    weight: String,
    dimensions: String,
    shortDesc: String,
    longDesc: String,
    images: [String]
  },
  { timestamps: true }
);

productSchema.index({ title: "text", vendor: "text", sku: "text" });

export const Product = mongoose.model("Product", productSchema);
