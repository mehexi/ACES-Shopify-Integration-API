import mongoose from "mongoose";

const aceSchema = new mongoose.Schema({
  sku: { type: String, required: true, index: true },
  yearFrom: { type: String, required: true },
  yearTo: { type: String, required: true },
  makeId: { type: String, required: true },
  modelId: { type: String, required: true },
  partTypeId: { type: String },
  positionId: { type: String },
}, { timestamps: true });

export const Ace = mongoose.models.Ace || mongoose.model("Ace", aceSchema);
