// routes/admin.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { sendMail } from "../utils/mailer.js";

const router = express.Router();

// ✅ helper: generate unique account number like PB12345678
async function generateAccountNumber() {
  while (true) {
    const n = Math.floor(10000000 + Math.random() * 90000000); // 8 digits
    const accountNumber = `PB${n}`;
    const exists = await Account.findOne({ accountNumber });
    if (!exists) return accountNumber;
  }
}

// ✅ GET /api/admin/users  (customers only)
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({
      $or: [{ role: "customer" }, { role: "user" }, { role: { $exists: false } }],
    })
      .select("fullName name email role status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = users.map((u) => ({
      _id: u._id,
      fullName: u.fullName || u.name || "",
      email: u.email,
      role: (u.role || "customer").toLowerCase(),
      status: (u.status || "active").toLowerCase(),
      createdAt: u.createdAt,
    }));

    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

/**
 * ✅ PATCH /api/admin/users/:id/status
 * body: { status: "active" | "disabled" }
 * This is what your Disable/Activate button should call.
 */
router.patch("/users/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "").toLowerCase();

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use active or disabled." });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).select("fullName name email role status createdAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      message: "User status updated",
      user: {
        _id: user._id,
        fullName: user.fullName || user.name || "",
        email: user.email,
        role: (user.role || "customer").toLowerCase(),
        status: (user.status || "active").toLowerCase(),
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error("ADMIN UPDATE USER STATUS ERROR:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

// ✅ GET /api/admin/accounts  (all accounts + owner info)
router.get("/accounts", requireAuth, requireAdmin, async (req, res) => {
  try {
    const accounts = await Account.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "email fullName name role")
      .lean();

    const mapped = accounts.map((a) => ({
      _id: a._id,
      accountNumber: a.accountNumber,
      type: a.type,
      balance: a.balance,
      status: a.status,
      createdAt: a.createdAt,
      userId: a.userId?._id,
      userEmail: a.userId?.email,
      userName: a.userId?.fullName || a.userId?.name,
    }));

    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

/**
 * ✅ PATCH /api/admin/accounts/:id/status  (OPTIONAL)
 * body: { status: "active" | "disabled" }
 * If you want to disable ONLY an account (not the whole user).
 */
router.patch("/accounts/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "").toLowerCase();

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use active or disabled." });
    }

    const acc = await Account.findByIdAndUpdate(id, { status }, { new: true })
      .populate("userId", "email fullName name role")
      .lean();

    if (!acc) return res.status(404).json({ message: "Account not found" });

    return res.json({ message: "Account status updated", account: acc });
  } catch (e) {
    console.error("ADMIN UPDATE ACCOUNT STATUS ERROR:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

// ✅ GET /api/admin/transactions (all transactions)
router.get("/transactions", requireAuth, requireAdmin, async (req, res) => {
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

    const [items, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "email fullName name")
        .populate("accountId", "accountNumber type")
        .populate("relatedAccountId", "accountNumber type")
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const mapped = items.map((t) => ({
      ...t,
      userEmail: t.userId?.email,
      userName: t.userId?.fullName || t.userId?.name,
      accountNumber: t.accountId?.accountNumber,
      accountType: t.accountId?.type,
      relatedAccountNumber: t.relatedAccountId?.accountNumber,
      relatedAccountType: t.relatedAccountId?.type,
    }));

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      items: mapped,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

// ✅ POST /api/admin/create-customer + EMAIL NOTIFICATION
router.post("/create-customer", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      email,
      password,
      fullName = "New Customer",
      createChequing = true,
      createSavings = false,
      chequingOpening = 0,
      savingsOpening = 0,
    } = req.body || {};

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: "Customer already exists" });

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      fullName,
      name: fullName,
      email: normalizedEmail,
      passwordHash,
      role: "customer",
      status: "active",
    });

    const accounts = [];
    let chequingAcc = null;
    let savingsAcc = null;

    if (createChequing) {
      chequingAcc = await Account.create({
        userId: user._id,
        type: "chequing",
        accountNumber: await generateAccountNumber(),
        balance: Number(chequingOpening) || 0,
        status: "active",
      });
      accounts.push(chequingAcc);
    }

    if (createSavings) {
      savingsAcc = await Account.create({
        userId: user._id,
        type: "savings",
        accountNumber: await generateAccountNumber(),
        balance: Number(savingsOpening) || 0,
        status: "active",
      });
      accounts.push(savingsAcc);
    }

    // ✅ EMAIL NOTIFICATION (won't fail the request if email fails)
    try {
      const money = (n) =>
        new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
          Number(n || 0)
        );

      const lines = [
        `Hello ${fullName || "Customer"},`,
        ``,
        `Welcome to Premium Bank! 🎉`,
        `Your new bank account has been created successfully.`,
        ``,
        `ACCOUNT DETAILS:`,
      ];

      if (chequingAcc) {
        lines.push(
          `• Chequing Account: ${chequingAcc.accountNumber}`,
          `  Opening Balance: ${money(chequingAcc.balance)}`
        );
      } else {
        lines.push(`• Chequing Account: Not created`);
      }

      if (savingsAcc) {
        lines.push(
          `• Savings Account: ${savingsAcc.accountNumber}`,
          `  Opening Balance: ${money(savingsAcc.balance)}`
        );
      } else {
        lines.push(`• Savings Account: Not created`);
      }

      lines.push(
        ``,
        `You can now login with your email address.`,
        `If you did not request this account, please contact support.`,
        ``,
        `— Premium Bank Team`
      );

      await sendMail({
        to: normalizedEmail,
        subject: "Premium Bank - Your New Account Has Been Created",
        text: lines.join("\n"),
      });
    } catch (mailErr) {
      console.error("ADMIN CREATE CUSTOMER EMAIL ERROR:", mailErr?.message || mailErr);
      // do not throw
    }

    return res.status(201).json({
      message: "Customer created",
      user: { id: user._id, email: user.email, role: user.role },
      accounts,
    });
  } catch (e) {
    console.error("ADMIN CREATE CUSTOMER ERROR:", e);
    return res.status(500).json({ message: e.message || "Server error" });
  }
});

export default router;