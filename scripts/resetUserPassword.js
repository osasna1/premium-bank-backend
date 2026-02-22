import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const input = String(process.argv[2] || "").trim();
const newPassword = String(process.argv[3] || "").trim();

if (!input || !newPassword) {
  console.log("Usage:");
  console.log("  node scripts/resetUserPassword.js <email_or_userId> <newPassword>");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI missing in .env");
  process.exit(1);
}

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected DB:", mongoose.connection.name);

    const query = isObjectId(input)
      ? { _id: input }
      : { email: input.toLowerCase() };

    const user = await User.findOne(query).select("+passwordHash");
    if (!user) {
      console.log("❌ User not found for:", query);
      process.exit(1);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log("✅ Password updated for:", user.email, "ID:", user._id.toString());
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();