// utils/mailer.js
import nodemailer from "nodemailer";
import dns from "dns";
import sgMail from "@sendgrid/mail";

// ✅ Force IPv4 first (fixes ENETUNREACH IPv6 errors on some hosts)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

// ---------------------------
// ✅ SENDGRID (preferred on Render)
// ---------------------------
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM; // e.g. Premium Bank <your_verified_sender@email.com>

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) throw new Error("Missing SMTP env variables");

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
  if (!to) throw new Error("Missing recipient email (to)");

  // ✅ 1) Try SendGrid first (works on Render because it's HTTPS)
  if (SENDGRID_API_KEY) {
    if (!SENDGRID_FROM) {
      throw new Error("Missing SENDGRID_FROM env variable");
    }

    await sgMail.send({
      to,
      from: SENDGRID_FROM,
      subject,
      text,
    });

    return { provider: "sendgrid", ok: true };
  }

  // ✅ 2) Fallback to SMTP (local dev)
  if (!cachedTransporter) cachedTransporter = buildTransporter();

  try {
    const info = await cachedTransporter.sendMail({
      from: `"Premium Bank" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    return info;
  } catch (err) {
    cachedTransporter = buildTransporter();
    const info = await cachedTransporter.sendMail({
      from: `"Premium Bank" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    return info;
  }
};