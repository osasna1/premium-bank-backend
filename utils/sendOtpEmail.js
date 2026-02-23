import sgMail from "@sendgrid/mail";

export async function sendOtpEmail(to, otp) {
  const email = String(to || "").trim();
  const code = String(otp || "").trim();

  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is missing in environment.");
  }

  if (!process.env.MAIL_FROM) {
    throw new Error("MAIL_FROM is missing in environment.");
  }

  if (!email) {
    throw new Error("Admin approver email is missing (ADMIN_APPROVER_EMAIL).");
  }

  if (!code) {
    throw new Error("OTP is missing.");
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: email,
    from: process.env.MAIL_FROM, // MUST be verified sender in SendGrid
    subject: "Premium Bank - Wire Transfer OTP Approval",
    text: `
Premium Bank - Wire Transfer Approval

An OTP approval was requested for a wire transfer.

OTP Code: ${code}

This OTP expires in 5 minutes.
If you did not request this approval, you can ignore this email.

— Premium Bank
    `.trim(),
  };

  try {
    await sgMail.send(msg);
    console.log("✅ OTP email sent successfully via SendGrid");
  } catch (err) {
    console.error("❌ SENDGRID ERROR:", err.response?.body || err.message);
    throw new Error("Failed to send OTP email.");
  }
}