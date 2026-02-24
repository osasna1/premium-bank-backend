// utils/mailer.js
import nodemailer from "nodemailer";
import dns from "dns";

// Force IPv4 first (helps some hosts like Render)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("Missing SMTP env variables");
  }

  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    family: 4,

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
  });
}

export const sendMail = async ({ to, subject, text }) => {
  if (!to) throw new Error("Missing recipient email");

  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
  }

  try {
    return await cachedTransporter.sendMail({
      from: `"Premium Bank" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("SMTP SEND FAILED:", err?.message || err);

    // Retry once if connection dropped
    cachedTransporter = buildTransporter();

    return await cachedTransporter.sendMail({
      from: `"Premium Bank" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
  }
};