// utils/sendOtpEmail.js
import { sendMail } from "./mailer.js";

export async function sendOtpEmail(to, otp) {
  const email = String(to || "").trim();
  const code = String(otp || "").trim();

  if (!email) throw new Error("Admin approver email is missing (ADMIN_APPROVER_EMAIL).");
  if (!code) throw new Error("OTP is missing.");

  const text = [
    "Premium Bank - Wire Transfer Approval",
    "",
    "An OTP approval was requested for a wire transfer.",
    "",
    `OTP Code: ${code}`,
    "",
    "This OTP expires in 5 minutes.",
    "If you did not request this approval, you can ignore this email.",
    "",
    "— Premium Bank",
  ].join("\n");

  try {
    return await sendMail({
      to: email,
      subject: "Premium Bank - Wire Transfer OTP Approval",
      text,
    });
  } catch (err) {
    // Make the error clearer in your Render logs
    const msg = err?.message || String(err);
    throw new Error(`Failed to send OTP email: ${msg}`);
  }
}