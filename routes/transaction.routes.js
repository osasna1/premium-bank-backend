// routes/transaction.routes.js
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import TransferOTP from "../models/TransferOTP.js";
import { sendOtpEmail } from "../utils/sendOtpEmail.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const makeRef = () =>
  `PB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const toAmountNumber = (val) => (typeof val === "string" ? Number(val) : val);

const isValidAmount = (amount) =>
  typeof amount === "number" && Number.isFinite(amount) && amount > 0;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const makeOtp = () => crypto.randomInt(100000, 999999).toString();

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

/**
 * ✅ TRANSACTION HISTORY
 * Sort by postedAt first (backdated), fallback createdAt
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { accountId, page = 1, limit = 20, type, direction, search } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId: req.user.id };

    if (accountId) {
      if (!isValidObjectId(accountId)) {
        return res.status(400).json({ message: "Invalid accountId" });
      }
      filter.accountId = accountId;
    }

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
        .populate("accountId", "accountNumber")
        .populate("relatedAccountId", "accountNumber")
        .sort({ postedAt: -1, createdAt: -1 }) // ✅ updated
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      items,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** ✅ DEPOSIT */
router.post("/deposit", requireAuth, async (req, res) => {
  const { accountId, amount, description = "Deposit" } = req.body;
  const amt = round2(toAmountNumber(amount));

  if (!accountId || !isValidObjectId(accountId) || !isValidAmount(amt)) {
    return res.status(400).json({
      message: "accountId (valid) and positive amount are required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id,
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "active") {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is not active" });
    }

    account.balance = round2(Number(account.balance || 0) + amt);
    await account.save({ session });

    const [tx] = await Transaction.insertMany(
      [
        {
          userId: req.user.id,
          accountId: account._id,
          type: "deposit",
          direction: "credit",
          amount: amt,
          description,
          reference: makeRef(),
          postedAt: new Date(), // ✅ added
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    return res.json({
      message: "Deposit successful",
      balance: account.balance,
      transaction: tx,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
});

/** ✅ WITHDRAW */
router.post("/withdraw", requireAuth, async (req, res) => {
  const { accountId, amount, description = "Withdrawal" } = req.body;
  const amt = round2(toAmountNumber(amount));

  if (!accountId || !isValidObjectId(accountId) || !isValidAmount(amt)) {
    return res.status(400).json({
      message: "accountId (valid) and positive amount are required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id,
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "active") {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is not active" });
    }

    if (Number(account.balance || 0) < amt) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient funds" });
    }

    account.balance = round2(Number(account.balance || 0) - amt);
    await account.save({ session });

    const [tx] = await Transaction.insertMany(
      [
        {
          userId: req.user.id,
          accountId: account._id,
          type: "withdrawal",
          direction: "debit",
          amount: amt,
          description,
          reference: makeRef(),
          postedAt: new Date(), // ✅ added
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    return res.json({
      message: "Withdrawal successful",
      balance: account.balance,
      transaction: tx,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
});

/** ✅ INTERNAL TRANSFER */
router.post("/transfer", requireAuth, async (req, res) => {
  const { fromAccountId, toAccountId, amount, description = "Transfer" } = req.body;
  const amt = round2(toAmountNumber(amount));

  if (
    !fromAccountId ||
    !toAccountId ||
    fromAccountId === toAccountId ||
    !isValidObjectId(fromAccountId) ||
    !isValidObjectId(toAccountId) ||
    !isValidAmount(amt)
  ) {
    return res.status(400).json({
      message:
        "fromAccountId and toAccountId (valid, different) and positive amount are required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const from = await Account.findOne({
      _id: fromAccountId,
      userId: req.user.id,
    }).session(session);

    const to = await Account.findOne({
      _id: toAccountId,
      userId: req.user.id,
    }).session(session);

    if (!from || !to) {
      await session.abortTransaction();
      return res.status(404).json({ message: "One or both accounts not found" });
    }
    if (from.status !== "active" || to.status !== "active") {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "One or both accounts are not active" });
    }
    if (Number(from.balance || 0) < amt) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient funds" });
    }

    from.balance = round2(Number(from.balance || 0) - amt);
    to.balance = round2(Number(to.balance || 0) + amt);

    await from.save({ session });
    await to.save({ session });

    const ref = makeRef();
    const now = new Date(); // ✅ same postedAt

    const tx = await Transaction.insertMany(
      [
        {
          userId: req.user.id,
          accountId: from._id,
          type: "transfer",
          direction: "debit",
          amount: amt,
          description: `${description} to ${to.accountNumber}`,
          reference: ref,
          relatedAccountId: to._id,
          postedAt: now, // ✅ added
        },
        {
          userId: req.user.id,
          accountId: to._id,
          type: "transfer",
          direction: "credit",
          amount: amt,
          description: `${description} from ${from.accountNumber}`,
          reference: ref,
          relatedAccountId: from._id,
          postedAt: now, // ✅ added
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();
    return res.json({
      message: "Transfer successful",
      reference: ref,
      from: { id: from._id, balance: from.balance },
      to: { id: to._id, balance: to.balance },
      transactions: tx,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
});

/**
 * ✅ BILL PAYMENT (NO OTP)
 * POST /api/transactions/bill-payment
 */
router.post("/bill-payment", requireAuth, async (req, res) => {
  const {
    accountId,
    amount,
    billerName,
    referenceNumber,
    description = "Bill payment",
  } = req.body;

  const amt = round2(toAmountNumber(amount));

  if (!accountId || !isValidObjectId(accountId)) {
    return res.status(400).json({ message: "Valid accountId is required" });
  }
  if (!isValidAmount(amt)) {
    return res.status(400).json({ message: "Positive amount is required" });
  }
  if (!String(billerName || "").trim()) {
    return res.status(400).json({ message: "billerName is required" });
  }
  if (!String(referenceNumber || "").trim()) {
    return res.status(400).json({ message: "referenceNumber is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const account = await Account.findOne({
      _id: accountId,
      userId: req.user.id,
    }).session(session);

    if (!account) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "active") {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is not active" });
    }
    if (Number(account.balance || 0) < amt) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient funds" });
    }

    account.balance = round2(Number(account.balance || 0) - amt);
    await account.save({ session });

    const ref = makeRef();

    const [tx] = await Transaction.insertMany(
      [
        {
          userId: req.user.id,
          accountId: account._id,
          type: "bill",
          direction: "debit",
          amount: amt,
          reference: ref,
          description: `${description} to ${String(billerName).trim()} (Ref: ${String(
            referenceNumber
          ).trim()})`,
          postedAt: new Date(), // ✅ added
        },
      ],
      { session, ordered: true }
    );

    await session.commitTransaction();

    return res.json({
      message: "Bill payment successful ✅",
      reference: ref,
      balance: account.balance,
      transaction: tx,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
});

/**
 * ✅ WIRE TRANSFER - Step 1 (Request OTP)
 */
async function wireRequestOtpHandler(req, res) {
  try {
    const {
      fromAccountId,
      amount,
      beneficiaryName,
      bankName,
      bankAccountNumber,
      description = "Wire transfer",
    } = req.body;

    const amt = round2(toAmountNumber(amount));

    if (!fromAccountId || !isValidObjectId(fromAccountId) || !isValidAmount(amt)) {
      return res.status(400).json({
        message: "Valid fromAccountId and positive amount are required",
      });
    }
    if (!String(beneficiaryName || "").trim())
      return res.status(400).json({ message: "beneficiaryName is required" });
    if (!String(bankName || "").trim())
      return res.status(400).json({ message: "bankName is required" });
    if (!String(bankAccountNumber || "").trim())
      return res.status(400).json({ message: "bankAccountNumber is required" });

    const from = await Account.findOne({ _id: fromAccountId, userId: req.user.id });

    if (!from) return res.status(404).json({ message: "From account not found" });
    if (from.status !== "active")
      return res.status(403).json({ message: "Account is not active" });
    if (Number(from.balance || 0) < amt)
      return res.status(400).json({ message: "Insufficient funds" });

    await TransferOTP.updateMany(
      { userId: req.user.id, purpose: "wire", used: { $ne: true } },
      { $set: { used: true } }
    );

    const otp = makeOtp();
    const otpHash = hashOtp(otp);

    await TransferOTP.create({
      userId: req.user.id,
      otpHash,
      purpose: "wire",
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      payload: {
        fromAccountId,
        amount: amt,
        beneficiaryName: String(beneficiaryName).trim(),
        bankName: String(bankName).trim(),
        bankAccountNumber: String(bankAccountNumber).trim(),
        description: String(description || "Wire transfer").trim(),
      },
    });

    const adminEmail = process.env.ADMIN_APPROVER_EMAIL;
    if (!adminEmail) {
      return res.status(500).json({
        message: "ADMIN_APPROVER_EMAIL missing in backend .env",
      });
    }

    await sendOtpEmail(adminEmail, otp);

    return res.json({ message: "OTP sent to admin email for approval" });
  } catch (err) {
    console.error("❌ WIRE REQUEST OTP ERROR FULL:", err);
    return res.status(500).json({
      message: "Failed to send OTP",
      error: err.message,
    });
  }
}

router.post("/wire/request-otp", requireAuth, wireRequestOtpHandler);
router.post("/pay-transfer/wire/request-otp", requireAuth, wireRequestOtpHandler);

/**
 * ✅ WIRE TRANSFER - Step 2 (Confirm OTP + Deduct)
 */
async function wireConfirmHandler(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { otp } = req.body;
    if (!String(otp || "").trim()) {
      await session.abortTransaction();
      return res.status(400).json({ message: "OTP is required" });
    }

    const record = await TransferOTP.findOne({
      userId: req.user.id,
      purpose: "wire",
      used: false,
    })
      .sort({ createdAt: -1 })
      .session(session);

    if (!record) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "No active OTP found. Click Transfer again to request a new OTP.",
      });
    }

    if (!record.expiresAt || record.expiresAt.getTime() < Date.now()) {
      record.used = true;
      await record.save({ session });

      await session.abortTransaction();
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    const incomingHash = hashOtp(String(otp).trim());
    if (incomingHash !== record.otpHash) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const payload = record.payload || {};
    const {
      fromAccountId,
      amount,
      beneficiaryName,
      bankName,
      bankAccountNumber,
      description,
    } = payload;

    if (!fromAccountId || !isValidObjectId(fromAccountId)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Transfer payload missing. Click Transfer again.",
      });
    }

    const amt = round2(toAmountNumber(amount));
    if (!isValidAmount(amt)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Invalid amount in transfer payload. Click Transfer again.",
      });
    }

    const from = await Account.findOne({
      _id: fromAccountId,
      userId: req.user.id,
    }).session(session);

    if (!from) {
      await session.abortTransaction();
      return res.status(404).json({ message: "From account not found" });
    }
    if (from.status !== "active") {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is not active" });
    }
    if (Number(from.balance || 0) < amt) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient funds" });
    }

    from.balance = round2(Number(from.balance || 0) - amt);
    await from.save({ session });

    const ref = makeRef();

    const [tx] = await Transaction.insertMany(
      [
        {
          userId: req.user.id,
          accountId: from._id,
          type: "wire",
          direction: "debit",
          amount: amt,
          description: `${String(description || "Wire transfer").trim()} to ${String(
            beneficiaryName || ""
          ).trim()} (${String(bankName || "").trim()} - ${String(
            bankAccountNumber || ""
          ).trim()})`,
          reference: ref,
          postedAt: new Date(), // ✅ added
        },
      ],
      { session, ordered: true }
    );

    record.used = true;
    await record.save({ session });

    await session.commitTransaction();

    return res.json({
      message: "Wire transfer successful ✅",
      reference: ref,
      from: { id: from._id, balance: from.balance },
      transaction: tx,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ WIRE CONFIRM ERROR FULL:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
}

router.post("/wire/confirm", requireAuth, wireConfirmHandler);
router.post("/pay-transfer/wire/confirm", requireAuth, wireConfirmHandler);

export default router;