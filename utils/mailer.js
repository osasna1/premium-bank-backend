// utils/mailer.js
import nodemailer from "nodemailer";

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465); // ✅ default 465 for Gmail SSL
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log("❌ Missing SMTP env variables:", {
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT,
      SMTP_USER: !!user,
      SMTP_PASS: !!pass,
    });
    throw new Error("Missing SMTP env variables");
  }

  const secure = port === 465; // ✅ 465 = SSL(true), 587 = TLS(false)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    // ✅ TLS settings for 587 (STARTTLS)
    ...(secure
      ? {}
      : {
          requireTLS: true,
          tls: {
            minVersion: "TLSv1.2",
          },
        }),

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter;
}

export const sendMail = async ({ to, subject, text }) => {
  if (!to) throw new Error("Missing recipient email (to)");

  // ✅ build once + reuse
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();

    // Optional: verify once at startup
    try {
      await cachedTransporter.verify();
      console.log("✅ SMTP verify OK:", process.env.SMTP_USER);
    } catch (err) {
      cachedTransporter = null;
      console.error("❌ SMTP VERIFY FAILED:", err?.message || err);
      throw err;
    }
  }

  try {
    const info = await cachedTransporter.sendMail({
      from: `"Premium Bank" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    return info;
  } catch (err) {
    console.error("❌ SMTP SEND FAILED:", err?.message || err);
    throw err;
  }
};