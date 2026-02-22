// utils/mailer.js
import nodemailer from "nodemailer";
import dns from "dns";

// ✅ Force IPv4 first (fixes ENETUNREACH IPv6 errors on some hosts)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // older Node versions may not support this; safe to ignore
}

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587); // ✅ default to 587 for STARTTLS
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

  const secure = port === 465; // ✅ 465 = SSL(true), 587 = STARTTLS(false)

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    // ✅ FORCE IPv4 to avoid IPv6 ENETUNREACH
    family: 4,

    // ✅ For 587 STARTTLS
    ...(secure
      ? {}
      : {
          requireTLS: true,
          tls: {
            minVersion: "TLSv1.2",
            servername: host,
          },
        }),

    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,

    // Turn on logs only if you set DEBUG_SMTP=true in Render env
    logger: String(process.env.DEBUG_SMTP || "").toLowerCase() === "true",
    debug: String(process.env.DEBUG_SMTP || "").toLowerCase() === "true",
  });
}

export const sendMail = async ({ to, subject, text }) => {
  if (!to) throw new Error("Missing recipient email (to)");

  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
  }

  // ✅ Verify before send (if verify fails, rebuild transporter next time)
  try {
    await cachedTransporter.verify();
  } catch (err) {
    console.error("❌ SMTP VERIFY FAILED:", err?.message || err);
    cachedTransporter = buildTransporter(); // rebuild and try once more
    await cachedTransporter.verify();
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