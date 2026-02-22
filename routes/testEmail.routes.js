import express from "express";
import { sendMail } from "../utils/mailer.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const to = process.env.ADMIN_APPROVER_EMAIL || process.env.SMTP_USER;

    await sendMail({
      to,
      subject: "Premium Bank Test Email ✅",
      text: "If you received this, SMTP is working.",
    });

    return res.json({ message: "Test email sent", to });
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    return res.status(500).json({ message: "Test email failed", error: err.message });
  }
});

export default router;