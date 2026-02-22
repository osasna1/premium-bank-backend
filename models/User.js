import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "", trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // ✅ allow BOTH old + new roles
    role: {
      type: String,
      enum: ["customer", "user", "admin"],
      default: "customer",
    },

    // ✅ UPDATED: allow disabled + blocked (backward compatible)
    status: {
      type: String,
      enum: ["active", "disabled", "blocked"],
      default: "active",
    },

    lastLoginAt: { type: Date, default: null },

    // ✅ OTP reset fields
    resetOtpHash: { type: String, select: false, default: null },
    resetOtpExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);