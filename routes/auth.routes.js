import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { sendMail } from "../utils/mailer.js";

const router = express.Router();

const signToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const hashOtp = (otp) => {
  const secret = process.env.OTP_SECRET || "default_otp_secret";
  return crypto.createHmac("sha256", secret).update(String(otp)).digest("hex");
};

// ✅ POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    // ✅ BLOCK LOGIN if account disabled/blocked
    const status = String(user.status || "active").toLowerCase();
    if (status === "disabled" || status === "blocked") {
      return res
        .status(403)
        .json({ message: "Your account has been disabled. Contact admin." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// ✅ POST /api/auth/forgot-password  (send OTP)
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    // ✅ don’t reveal if user exists
    if (!user) return res.json({ message: "If the email exists, OTP has been sent." });

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendMail({
      to: email,
      subject: "Premium Bank - Password Reset OTP",
      text: `Your Premium Bank OTP is: ${otp}\n\nThis OTP expires in 10 minutes.\nIf you did not request this, ignore this email.`,
    });

    return res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// ✅ POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email }).select("+resetOtpHash");
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "OTP not found. Request a new OTP." });
    }

    if (new Date(user.resetOtpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Request a new OTP." });
    }

    const isValid = user.resetOtpHash === hashOtp(otp);
    if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

    return res.json({ message: "OTP verified" });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// ✅ POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email }).select("+resetOtpHash +passwordHash");
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "OTP not found. Request a new OTP." });
    }

    if (new Date(user.resetOtpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Request a new OTP." });
    }

    const isValid = user.resetOtpHash === hashOtp(otp);
    if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    await user.save();

    return res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;