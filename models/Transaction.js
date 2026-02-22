// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    // ✅ (optional) for internal transfers
    relatedAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // ✅ Added "bill"
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer", "wire", "bill"],
      required: true,
      index: true,
    },

    direction: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    description: {
      type: String,
      default: "",
    },

    reference: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);