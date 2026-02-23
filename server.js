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
 * ✅ Allowed Frontend Origins
 * Add ALL your frontend URLs here
 */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://premium-bank-frontend.onrender.com",
  "https://premiumbankonline.org",
  "https://www.premiumbankonline.org",
];

/**
 * ✅ CORS Middleware
 */
app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman, mobile apps, server-to-server
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.log("❌ Blocked CORS origin:", origin);

      // You currently allow anyway (so it won’t block)
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * ✅ Handle preflight requests explicitly
 * FIX: Use RegExp (Express/router rejects "*" and "/*" in your setup)
 */
app.options(/.*/, cors());

/**
 * ✅ Body Parser
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ✅ Request Logger (helps debugging)
 */
app.use((req, res, next) => {
  console.log(
    `➡️ ${req.method} ${req.originalUrl} | origin=${req.headers.origin || "none"}`
  );
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

app.get("/", (req, res) =>
  res.json({ message: "Premium Bank API running 🚀" })
);

/**
 * ✅ 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/**
 * ✅ Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

/**
 * ✅ MongoDB + Server Start
 */
async function start() {
  try {
    if (!process.env.MONGO_URI) {
      console.log("❌ MONGO_URI missing");
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