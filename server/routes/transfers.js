// The ACID transfer engine, now on a real MongoDB multi-document transaction.
//
//   Atomicity  : debit, credit and both ledger entries are written in one transaction. Any error
//                (including the "simulate a crash" switch) aborts it and MongoDB undoes everything.
//   Consistency: the debit is a conditional write { balance: { $gte: amount } }: a balance can never go negative.
//   Isolation  : both accounts are written first ("lock" step). A concurrent transfer on the same
//                account hits a write conflict and is retried by MongoDB on the up-to-date balance.
//   Durability : committed with writeConcern "majority"; ledger entries are never edited.
//
// The amount and the balances are always taken from the server, never from the browser.
import express from "express";
import { inTransaction, collections } from "../db.js";
import { ApiError } from "../errors.js";
import { claim, previousResponse, remember } from "../idempotency.js";
import { audit } from "../security/audit.js";
import { moneyLimiter } from "../security/rateLimits.js";
import { newId, nextSeq } from "../security/tokens.js";
import * as v from "../validate.js";
import { formatTnd } from "../../src/utils/money.js";
import { findOwnedAccount } from "./accounts.js";

export function transferRoutes() {
  const router = express.Router();

  router.post("/", moneyLimiter, async (req, res) => {
    const replay = await previousResponse(req);
    if (replay) return res.status(201).json(replay);

    // 1. Input checks: they fail before any transaction starts.
    const body = v.onlyFields(req.body, ["fromAccountId", "toAccountId", "amount", "description", "simulateFailure"]);
    const notFound = { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." };
    const fromAccountId = v.id(body.fromAccountId, notFound);
    const toAccountId = v.id(body.toAccountId, notFound);
    const amount = v.millimes(body.amount);
    const note = v.text(body.description, { min: 0, max: 120, message: "The note can have at most 120 characters." });
    const simulateFailure = v.bool(body.simulateFailure);
    if (fromAccountId === toAccountId) throw new ApiError("SAME_ACCOUNT", "Choose two different accounts.");
    const userId = req.user._id;

    let steps = [];
    const step = (key, title, detail, status) => steps.push({ key, title, detail, status });

    try {
      const result = await inTransaction(async (session) => {
        steps = []; // MongoDB may run this function again after a write conflict
        const key = await claim(req, session);

        // 2. BEGIN
        step("begin", "Start of the transaction", "Everything that follows is one single block.", "ok");
        const source = await findOwnedAccount(userId, fromAccountId, session);
        const target = await findOwnedAccount(userId, toAccountId, session);
        if (source.status === "closed" || target.status === "closed") {
          throw new ApiError("ACCOUNT_CLOSED", "A closed account cannot send or receive money.");
        }

        // 3. LOCK: writing to both accounts takes MongoDB's write lock on them until commit.
        await collections.accounts.updateMany(
          { _id: { $in: [source._id, target._id] }, userId },
          { $set: { lockedAt: new Date() } },
          { session }
        );
        step("lock", "Both accounts are locked", "No other transfer can change them meanwhile.", "ok");

        // 4. DEBIT, only if the up-to-date balance is enough.
        const debited = await collections.accounts.findOneAndUpdate(
          { _id: source._id, userId, status: "active", balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { session, returnDocument: "after" }
        );
        if (!debited) {
          const fresh = await collections.accounts.findOne({ _id: source._id }, { session });
          step("debit", "Debit " + source.name, "Balance too low: " + formatTnd(fresh.balance) + " available.", "failed");
          step("rollback", "Rollback", "Nothing was changed.", "rolledback");
          throw new ApiError("INSUFFICIENT_FUNDS", "Insufficient balance: " + formatTnd(fresh.balance) + " available.");
        }
        const when = new Date();
        const transferId = newId("trf");
        await collections.transactions.insertOne(
          {
            _id: newId("txn"),
            userId,
            accountId: source._id,
            type: "debit",
            amount,
            categoryId: "cat_transfer",
            description: note || "Transfer to " + target.name,
            date: when,
            transferId,
            balanceAfter: debited.balance,
            seq: nextSeq(),
          },
          { session }
        );
        step("debit", "Debit " + source.name, "− " + formatTnd(amount), "ok");

        // 5. The "simulate a crash" switch: abort between debit and credit. MongoDB rolls the debit back.
        if (simulateFailure) {
          step("credit", "Crash before the credit", target.name + " was never credited.", "failed");
          step("rollback", "Rollback", "The debit is undone: no balance changes.", "rolledback");
          throw new ApiError("TRANSFER_FAILED", "The transfer failed before the credit and was rolled back. No balance changed.");
        }

        // 6. CREDIT
        const credited = await collections.accounts.findOneAndUpdate(
          { _id: target._id, userId, status: "active" },
          { $inc: { balance: amount } },
          { session, returnDocument: "after" }
        );
        await collections.transactions.insertOne(
          {
            _id: newId("txn"),
            userId,
            accountId: target._id,
            type: "credit",
            amount,
            categoryId: "cat_transfer",
            description: note || "Transfer from " + source.name,
            date: when,
            transferId,
            balanceAfter: credited.balance,
            seq: nextSeq(),
          },
          { session }
        );
        step("credit", "Credit " + target.name, "+ " + formatTnd(amount), "ok");

        // 7. COMMIT happens when this function returns.
        step("commit", "Commit", "Debit and credit are saved together.", "ok");
        const response = {
          transferId,
          amount,
          steps,
          from: { _id: source._id, name: source.name, balance: debited.balance },
          to: { _id: target._id, name: target.name, balance: credited.balance },
        };
        await remember(key, response, session);
        return response;
      });
      await audit(req, "transfer_committed", { details: { transferId: result.transferId, amount } });
      res.status(201).json(result);
    } catch (err) {
      // The journal goes back to the page, so it can show where the transfer stopped.
      if (err instanceof ApiError && steps.length) err.extra = { ...err.extra, steps };
      throw err;
    }
  });

  return router;
}
