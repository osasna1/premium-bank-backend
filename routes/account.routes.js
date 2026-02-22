import express from "express";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// ✅ helper: support both id and _id
const getUserId = (req) => String(req.user?.id || req.user?._id || "");

// GET my accounts (auto-create chequing + savings if none exist)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Invalid token payload" });

    let accounts = await Account.find({ userId }).sort({ createdAt: 1 });

    if (!accounts.length) {
      const makeAccNo = () => `PB${Math.floor(10000000 + Math.random() * 90000000)}`;

      const created = await Account.insertMany([
        {
          userId,
          type: "chequing",
          accountNumber: makeAccNo(),
          balance: 0,
          status: "active",
        },
        {
          userId,
          type: "savings",
          accountNumber: makeAccNo(),
          balance: 0,
          status: "active",
        },
      ]);

      accounts = created;
    }

    return res.json(accounts);
  } catch (err) {
    console.error("GET /api/accounts ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET transactions for a specific account
router.get("/:id/transactions", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Invalid token payload" });

    const account = await Account.findOne({ _id: req.params.id, userId });
    if (!account) return res.status(404).json({ message: "Account not found" });

    const tx = await Transaction.find({ accountId: account._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(tx);
  } catch (err) {
    console.error("GET /api/accounts/:id/transactions ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;