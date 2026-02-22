// models/TransferOTP.js
import mongoose from "mongoose";

const TransferOTPSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    purpose: {
      type: String,
      required: true,
      default: "wire",
    },

    otpHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    payload: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

// Auto-delete expired OTP docs
TransferOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TransferOTP =
  mongoose.models.TransferOTP || mongoose.model("TransferOTP", TransferOTPSchema);

export default TransferOTP;