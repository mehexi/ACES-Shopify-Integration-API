import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ Missing MONGO_URI in .env");
    process.exit(1);
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { autoIndex: true });
  console.log("✅ MongoDB connected");
}
