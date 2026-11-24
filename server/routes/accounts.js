// Accounts of the logged-in user. Every query is filtered by req.user._id, so nobody can read or
// change another user's account by guessing its id.
import express from "express";
import { collections, inTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { moneyLimiter } from "../security/rateLimits.js";
import { newId, nextSeq } from "../security/tokens.js";
import * as v from "../validate.js";

const ACCOUNT_TYPES = ["checking", "savings", "cash"];
const nameRule = { min: 2, max: 40, message: "The account name needs 2 to 40 characters." };

export function publicAccount(account, lastMovementAt = null) {
  return {
    _id: account._id,
    name: account.name,
    type: account.type,
    openingBalance: account.openingBalance,
    balance: account.balance,
    currency: account.currency,
    status: account.status,
    closedAt: account.closedAt,
    lastMovementAt,
  };
}

export async function findOwnedAccount(userId, accountId, session) {
  const account = await collections.accounts.findOne({ _id: accountId, userId }, { session });
  if (!account) throw new ApiError("ACCOUNT_NOT_FOUND", "This account does not exist.");
  return account;
}

export function accountRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const userId = req.user._id;
    const accounts = await collections.accounts.find({ userId }).toArray();
    const last = await collections.transactions
      .aggregate([{ $match: { userId } }, { $group: { _id: "$accountId", lastMovementAt: { $max: "$date" } } }])
      .toArray();
    const lastById = Object.fromEntries(last.map((row) => [row._id, row.lastMovementAt]));
    const list = accounts
      .map((a) => publicAccount(a, lastById[a._id] || null))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
    res.json(list);
  });

  router.post("/", moneyLimiter, async (req, res) => {
    const body = v.onlyFields(req.body, ["name", "type", "initialDeposit"]);
    const name = v.text(body.name, nameRule);
    const type = v.oneOf(body.type, ACCOUNT_TYPES, "Choose an account type.");
    const initialDeposit =
      body.initialDeposit === undefined ? 0 : v.millimes(body.initialDeposit, { min: 0, message: "The initial deposit must be 0 or more." });
    const userId = req.user._id;

    const open = await collections.accounts.countDocuments({ userId, status: "active" });
    if (open >= 20) throw new ApiError("VALIDATION_ERROR", "You can have at most 20 open accounts.");

    const account = await inTransaction(async (session) => {
      const now = new Date();
      const doc = {
        _id: newId("acc"),
        userId,
        name,
        type,
        openingBalance: 0,
        balance: initialDeposit,
        currency: "TND",
        status: "active",
        closedAt: null,
        createdAt: now,
      };
      await collections.accounts.insertOne(doc, { session });
      if (initialDeposit > 0) {
        await collections.transactions.insertOne(
          {
            _id: newId("txn"),
            userId,
            accountId: doc._id,
            type: "credit",
            amount: initialDeposit,
            categoryId: "cat_other_income",
            description: "Initial deposit",
            date: now,
            transferId: null,
            balanceAfter: initialDeposit,
            seq: nextSeq(),
          },
          { session }
        );
      }
      return doc;
    });
    res.status(201).json(publicAccount(account));
  });

  router.patch("/:accountId", async (req, res) => {
    const accountId = v.id(req.params.accountId, { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." });
    const body = v.onlyFields(req.body, ["name"]);
    const name = v.text(body.name, nameRule);
    const account = await collections.accounts.findOneAndUpdate(
      { _id: accountId, userId: req.user._id },
      { $set: { name } },
      { returnDocument: "after" }
    );
    if (!account) throw new ApiError("ACCOUNT_NOT_FOUND", "This account does not exist.");
    res.json(publicAccount(account));
  });

  // Closing needs a balance of exactly 0; the condition is checked by MongoDB in the same write.
  router.post("/:accountId/close", async (req, res) => {
    const accountId = v.id(req.params.accountId, { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." });
    const userId = req.user._id;
    const account = await collections.accounts.findOneAndUpdate(
      { _id: accountId, userId, status: "active", balance: 0 },
      { $set: { status: "closed", closedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (account) return res.json(publicAccount(account));

    const current = await findOwnedAccount(userId, accountId);
    if (current.status === "closed") throw new ApiError("ACCOUNT_CLOSED", "This account is already closed.");
    throw new ApiError("ACCOUNT_NOT_EMPTY", "Move the remaining money out of this account before closing it.");
  });

  return router;
}
