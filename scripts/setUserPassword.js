import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI / MONGODB_URI in .env");
  process.exit(1);
}

const email = String(process.argv[2] || "").trim().toLowerCase();
const newPassword = String(process.argv[3] || "");

if (!email || !newPassword) {
  console.log("Usage:");
  console.log("node scripts/setUserPassword.js <email> <newPassword>");
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    const hash = await bcrypt.hash(newPassword, 10);

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          passwordHash: hash,
          status: "active",
        },
      },
      { new: true }
    ).select("+passwordHash");

    if (!user) {
      console.log("❌ User not found:", email);
    } else {
      console.log("✅ Password updated for:", user.email);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Script error:", err.message);
    process.exit(1);
  }
}

run();
