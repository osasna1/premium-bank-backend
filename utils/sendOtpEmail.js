// utils/sendOtpEmail.js
import { sendMail } from "./mailer.js";

export async function sendOtpEmail(to, otp) {
  if (!to) throw new Error("Admin approver email is missing");

  const text = [
    "Premium Bank - Wire Transfer Approval",
    "",
    `OTP Code: ${otp}`,
    "",
    "This OTP expires in 5 minutes.",
    "If you did not request this approval, ignore this email.",
    "",
    "— Premium Bank",
  ].join("\n");

  // Use the SAME mailer that works in admin.create-customer
  return sendMail({
    to,
    subject: "Premium Bank - Wire Transfer OTP Approval",
    text,
  });
}