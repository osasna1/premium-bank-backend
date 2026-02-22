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
 * ✅ CORS (Local + Render frontend + Custom domain)
 * Add these in Render env:
 * - FRONTEND_URL=https://premium-bank-frontend.onrender.com
 * - CUSTOM_FRONTEND_URL=https://premiumbankonline.org   (later when ready)
 */
const allowedOrigins = new Set([
  // Local Vite
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // If you ever run a different local port
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

// Pull from Render env (recommended)
if (process.env.FRONTEND_URL) allowedOrigins.add(process.env.FRONTEND_URL);
if (process.env.CUSTOM_FRONTEND_URL) allowedOrigins.add(process.env.CUSTOM_FRONTEND_URL);

// Optional: allow multiple extra origins comma-separated
// Example: EXTRA_ORIGINS=https://a.com,https://b.com
if (process.env.EXTRA_ORIGINS) {
  process.env.EXTRA_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => allowedOrigins.add(o));
}

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (Postman, curl)
    if (!origin) return cb(null, true);

    if (allowedOrigins.has(origin)) return cb(null, true);

    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// ✅ CORS must be BEFORE routes
app.use(cors(corsOptions));

/**
 * ✅ IMPORTANT FIX
 * DO NOT use app.options("*", ...)  (can crash on Render)
 * Use "/*" instead.
 */
app.options("/*", cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * ✅ Request logger
 */
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl} | origin=${req.headers.origin || "none"}`);
  next();
});

/**
 * ✅ Routes
 */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/test-email", testEmailRoutes);

app.get("/", (req, res) => res.json({ message: "Premium Bank API running" }));

/**
 * ✅ 404 (no path wildcard needed)
 */
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

/**
 * ✅ Global error handler
 */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.message);

  const isDev = process.env.NODE_ENV !== "production";

  res.status(err.status || 500).json({
    message: err.message || "Server error",
    ...(isDev ? { stack: err.stack } : {}),
  });
});

/**
 * ✅ MongoDB connect + listen
 */
async function start() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI?.trim();

    if (!mongoUri) {
      console.log("❌ MONGO_URI missing in env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

start();