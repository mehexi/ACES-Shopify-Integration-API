import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, index: true },
    sku: { type: String, index: true, unique: true, sparse: true },
    vendor: { type: String, index: true },
    attributes: { type: Map, of: String },
    pricing: {
      type: Map,
      of: Number, // e.g. { MSRP: 129.99, Jobber: 98.5, MAP: 119.99 }
      default: {}
    },
    qtyAvailable: { type: Number, default: 0 },
    weight: String,
    dimensions: String,
    shortDesc: String,
    longDesc: String,
    category: String,
    piesSegment: String,
    piesBase: String,
    piesSub: String,
    images: [String],
    synced: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ title: "text", vendor: "text", sku: "text" });

export const Product = mongoose.model("Product", productSchema);
