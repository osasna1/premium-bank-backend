import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGO_URI in .env");
  }

  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
};
