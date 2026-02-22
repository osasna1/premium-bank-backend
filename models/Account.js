import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["chequing", "savings"],
      required: true,
    },

    accountNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Updated for admin enable/disable
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Account", accountSchema);