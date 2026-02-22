import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import testEmailRoutes from "./routes/testEmail.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";

dotenv.config();

const app = express();

/**
 * ✅ CORS (Local + Render Frontend + Custom Domain)
 * Uses env vars if you set them on Render:
 * - FRONTEND_URL=https://premium-bank-frontend.onrender.com
 * - CUSTOM_FRONTEND_URL=https://premiumbankonline.org
 */
const localAllowed = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const envAllowed = [
  process.env.FRONTEND_URL,
  process.env.CUSTOM_FRONTEND_URL,
].filter(Boolean);

// helper to normalize (remove trailing slash)
const normalize = (u) => (u ? u.replace(/\/$/, "") : u);

const allowedOrigins = new Set([
  ...localAllowed.map(normalize),
  ...envAllowed.map(normalize),
  // ✅ your Render frontend (to be safe)
  "https://premium-bank-frontend.onrender.com",
]);

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (Postman/curl)
    if (!origin) return cb(null, true);

    const o = normalize(origin);

    // allow exact matches
    if (allowedOrigins.has(o)) return cb(null, true);

    // allow any *.onrender.com (optional but helpful)
    if (/^https:\/\/.*\.onrender\.com$/.test(o)) return cb(null, true);

    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// ✅ IMPORTANT: handle preflight
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/** ✅ Request logger */
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  next();
});

/** ✅ Routes */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/test-email", testEmailRoutes);

app.get("/", (req, res) => res.json({ message: "Premium Bank API running" }));

/** ✅ 404 */
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

/** ✅ Global error handler */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  const isDev = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    message: err.message || "Server error",
    ...(isDev ? { stack: err.stack } : {}),
  });
});

/** ✅ MongoDB connect */
async function start() {
  try {
    if (!process.env.MONGO_URI) {
      console.log("❌ MONGO_URI missing in env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

start();