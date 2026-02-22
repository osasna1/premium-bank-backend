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
 * Add these in Render env when ready:
 * - FRONTEND_URL=https://premium-bank-frontend.onrender.com
 * - CUSTOM_FRONTEND_URL=https://premiumbankonline.org
 */
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

if (process.env.FRONTEND_URL) allowedOrigins.add(process.env.FRONTEND_URL);
if (process.env.CUSTOM_FRONTEND_URL) allowedOrigins.add(process.env.CUSTOM_FRONTEND_URL);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/curl
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// ✅ Must be BEFORE routes
app.use(cors(corsOptions));

/**
 * ✅ IMPORTANT FIX (Render crash fix)
 * Don't use: app.options("*") or app.options("/*")
 * Instead handle OPTIONS requests safely here:
 */
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

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
 * ✅ 404
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
 * ✅ MongoDB connect + start server
 */
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