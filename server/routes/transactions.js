// Categories and the ledger. The ledger is append-only: there is no route to edit or delete a movement.
import express from "express";
import { collections, inTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { claim, previousResponse, remember } from "../idempotency.js";
import { moneyLimiter } from "../security/rateLimits.js";
import { newId, nextSeq } from "../security/tokens.js";
import * as v from "../validate.js";
import { findOwnedAccount } from "./accounts.js";

const TYPES = ["all", "expense", "income", "transfer"];

export function publicTransaction(t) {
  return {
    _id: t._id,
    accountId: t.accountId,
    type: t.type,
    amount: t.amount,
    categoryId: t.categoryId,
    description: t.description,
    date: t.date,
    transferId: t.transferId,
    balanceAfter: t.balanceAfter,
    seq: t.seq,
  };
}

function startOfDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function endOfDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function categoryRoutes() {
  const router = express.Router();
  router.get("/", async (req, res) => {
    const categories = await collections.categories.find({}, { projection: { _id: 1, name: 1, kind: 1 } }).toArray();
    res.json(categories);
  });
  return router;
}

export function transactionRoutes() {
  const router = express.Router();

  // Filters, sorts (newest first) and paginates. The MongoDB filter is built field by field from
  // validated values only: user input is never passed to the database as an object.
  router.get("/", async (req, res) => {
    const q = req.query;
    const userId = req.user._id;
    const accountId = v.optionalId(q.accountId, { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." });
    const type = v.oneOf(q.type || "all", TYPES, "Choose a type of movement.");
    const categoryId = v.optionalId(q.categoryId, { prefix: "cat" });
    const from = v.optionalDay(q.from);
    const to = v.optionalDay(q.to);
    const minAmount = v.optionalMillimes(q.minAmount);
    const maxAmount = v.optionalMillimes(q.maxAmount);
    const page = v.intParam(q.page, { fallback: 1, min: 1, max: 100000 });
    const limit = v.intParam(q.limit, { fallback: 10, min: 1, max: 50 });

    const filter = { userId };
    if (accountId) {
      await findOwnedAccount(userId, accountId);
      filter.accountId = accountId;
    }
    if (type === "expense") Object.assign(filter, { type: "debit", transferId: null });
    if (type === "income") Object.assign(filter, { type: "credit", transferId: null });
    if (type === "transfer") filter.transferId = { $ne: null };
    if (categoryId) filter.categoryId = categoryId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(from);
      if (to) filter.date.$lte = endOfDay(to);
    }
    if (minAmount !== null || maxAmount !== null) {
      filter.amount = {};
      if (minAmount !== null) filter.amount.$gte = minAmount;
      if (maxAmount !== null) filter.amount.$lte = maxAmount;
    }

    const total = await collections.transactions.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const items = await collections.transactions
      .find(filter)
      .sort({ date: -1, seq: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .toArray();
    res.json({ items: items.map(publicTransaction), total, page: safePage, limit, totalPages });
  });

  // Adds an expense or an income. The balance check and the update are one conditional write,
  // inside a transaction with the ledger entry: an expense can never push a balance below 0.
  router.post("/", moneyLimiter, async (req, res) => {
    const replay = await previousResponse(req);
    if (replay) return res.status(201).json(replay);

    const body = v.onlyFields(req.body, ["accountId", "kind", "amount", "categoryId", "description"]);
    const accountId = v.id(body.accountId, { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." });
    const kind = v.oneOf(body.kind, ["expense", "income"], "Choose expense or income.");
    const amount = v.millimes(body.amount);
    const categoryId = v.id(body.categoryId, { prefix: "cat", code: "CATEGORY_NOT_FOUND", message: "Choose a category that matches the operation." });
    const description = v.text(body.description, { min: 2, max: 120, message: "Add a short description (2 to 120 characters)." });
    const userId = req.user._id;

    const category = await collections.categories.findOne({ _id: categoryId });
    if (!category || category.kind !== kind) {
      throw new ApiError("CATEGORY_NOT_FOUND", "Choose a category that matches the operation.");
    }

    const transaction = await inTransaction(async (session) => {
      const key = await claim(req, session);
      const account = await findOwnedAccount(userId, accountId, session);
      if (account.status === "closed") throw new ApiError("ACCOUNT_CLOSED", "This account is closed.");

      const delta = kind === "income" ? amount : -amount;
      const condition = kind === "expense" ? { balance: { $gte: amount } } : {};
      const updated = await collections.accounts.findOneAndUpdate(
        { _id: accountId, userId, status: "active", ...condition },
        { $inc: { balance: delta } },
        { session, returnDocument: "after" }
      );
      if (!updated) throw new ApiError("INSUFFICIENT_FUNDS", "This expense is higher than the account balance.");

      const doc = {
        _id: newId("txn"),
        userId,
        accountId,
        type: kind === "income" ? "credit" : "debit",
        amount,
        categoryId,
        description,
        date: new Date(),
        transferId: null,
        balanceAfter: updated.balance,
        seq: nextSeq(),
      };
      await collections.transactions.insertOne(doc, { session });
      const response = publicTransaction(doc);
      await remember(key, response, session);
      return response;
    });
    res.status(201).json(transaction);
  });

  return router;
}
