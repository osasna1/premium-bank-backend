import express from "express";
import Transaction from "../models/Transaction.js";
import { requireAuth } from "../middleware/requireAuth.js";   // ✅ FIX
import { requireAdmin } from "../middleware/requireAdmin.js"; // ✅ FIX

const router = express.Router();

// GET /api/admin/transactions
router.get("/", requireAuth, requireAdmin, async (req, res) => { // ✅ FIX
  try {
    const { accountId, page = 1, limit = 50, type, direction, search } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (accountId) filter.accountId = accountId;
    if (type) filter.type = type;
    if (direction) filter.direction = direction;

    if (search && String(search).trim()) {
      const s = String(search).trim();
      filter.$or = [
        { description: { $regex: s, $options: "i" } },
        { reference: { $regex: s, $options: "i" } },
      ];
    }

    const query = Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // ✅ Only populate if those fields exist in your schema (won’t break if they don't)
    query.populate("userId", "email fullName name");
    query.populate("accountId", "accountNumber type");
    query.populate("relatedAccountId", "accountNumber type");

    const [items, total] = await Promise.all([
      query.lean(),
      Transaction.countDocuments(filter),
    ]);

    const mapped = items.map((t) => ({
      ...t,
      userEmail: t.userId?.email,
      userName: t.userId?.fullName || t.userId?.name,
      accountNumber: t.accountId?.accountNumber,
      relatedAccountNumber: t.relatedAccountId?.accountNumber,
    }));

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      items: mapped,
    });
  } catch (err) {
    console.error("ADMIN TRANSACTIONS ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
