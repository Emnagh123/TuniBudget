// The ACID transfer engine, simulated in the front-end.
//
//   Atomicity  : all changes are made on a draft copy and committed in one assignment.
//   Consistency: a balance can never become negative.
//   Isolation  : transfers go through a global lock queue (withLock).
//   Durability : a committed transfer is two ledger entries that are never edited.
import { db, nextId, nextSeq } from "./db.js";
import { ServiceError, delay, withLock } from "./errors.js";
import { requireUserId } from "./session.js";
import { findOwnedAccount } from "./queries.js";
import { formatTnd } from "../utils/money.js";

/** The five steps of a transfer, with their titles. Used for the preview and the journal. */
export function planTransferSteps({ fromName, toName, amount, simulateFailure }) {
  const money = formatTnd(amount);
  return [
    { key: "begin", title: "Start of the transaction", detail: "Everything that follows is one single block." },
    { key: "lock", title: "Both accounts are locked", detail: "No other transfer can change them meanwhile." },
    { key: "debit", title: "Debit " + fromName, detail: "− " + money },
    simulateFailure
      ? { key: "credit", title: "Crash before the credit", detail: toName + " was never credited." }
      : { key: "credit", title: "Credit " + toName, detail: "+ " + money },
    simulateFailure
      ? { key: "rollback", title: "Rollback", detail: "The debit is undone: no balance changes." }
      : { key: "commit", title: "Commit", detail: "Debit and credit are saved together." },
  ];
}

export function transfer({ fromAccountId, toAccountId, amount, description = "", simulateFailure = false }) {
  const userId = requireUserId();

  // 1. Input checks. They fail before any transaction starts.
  if (!Number.isInteger(amount) || amount <= 0) {
    return Promise.reject(new ServiceError("INVALID_AMOUNT", "Enter an amount greater than 0."));
  }
  if (fromAccountId === toAccountId) {
    return Promise.reject(new ServiceError("SAME_ACCOUNT", "Choose two different accounts."));
  }

  // 2. Wait for the lock, then run the whole transfer as one transaction.
  return withLock(async () => {
    await delay();
    const steps = [];
    const step = (key, title, detail, status) => steps.push({ key, title, detail, status });

    const source = findOwnedAccount(userId, fromAccountId);
    const target = findOwnedAccount(userId, toAccountId);
    if (source.status === "closed" || target.status === "closed") {
      throw new ServiceError("ACCOUNT_CLOSED", "A closed account cannot send or receive money.");
    }
    const plan = planTransferSteps({ fromName: source.name, toName: target.name, amount, simulateFailure });
    const fail = (code, message) => {
      throw new ServiceError(code, message, { steps });
    };

    // 3. BEGIN: build a draft copy. The real data is not touched until COMMIT.
    step("begin", plan[0].title, plan[0].detail, "ok");
    const draftAccounts = db.accounts.map((a) => ({ ...a }));
    const draftTransactions = [...db.transactions];
    const draftSource = draftAccounts.find((a) => a._id === source._id);
    const draftTarget = draftAccounts.find((a) => a._id === target._id);
    step("lock", plan[1].title, plan[1].detail, "ok");

    // 4. Debit, after checking the balance on the up-to-date data.
    if (draftSource.balance < amount) {
      step("debit", "Debit " + source.name, "Balance too low: " + formatTnd(draftSource.balance) + " available.", "failed");
      step("rollback", "Rollback", "Nothing was changed.", "rolledback");
      fail("INSUFFICIENT_FUNDS", "Insufficient balance: " + formatTnd(draftSource.balance) + " available.");
    }
    const when = new Date().toISOString();
    const transferId = nextId("trf");
    draftSource.balance -= amount;
    draftTransactions.push({
      _id: nextId("txn"),
      accountId: source._id,
      type: "debit",
      amount,
      categoryId: "cat_transfer",
      description: String(description).trim() || "Transfer to " + target.name,
      date: when,
      transferId,
      balanceAfter: draftSource.balance,
      seq: nextSeq(),
    });
    step("debit", plan[2].title, plan[2].detail, "ok");

    // 5. Time passes between the debit and the credit: this is where a crash can happen.
    await delay();
    if (simulateFailure) {
      step("credit", plan[3].title, plan[3].detail, "failed");
      step("rollback", plan[4].title, plan[4].detail, "rolledback");
      fail("TRANSFER_FAILED", "The transfer failed before the credit and was rolled back. No balance changed.");
    }

    // 6. Credit.
    draftTarget.balance += amount;
    draftTransactions.push({
      _id: nextId("txn"),
      accountId: target._id,
      type: "credit",
      amount,
      categoryId: "cat_transfer",
      description: String(description).trim() || "Transfer from " + source.name,
      date: when,
      transferId,
      balanceAfter: draftTarget.balance,
      seq: nextSeq(),
    });
    step("credit", plan[3].title, plan[3].detail, "ok");

    // 7. COMMIT: both changes become real in one single assignment.
    db.accounts = draftAccounts;
    db.transactions = draftTransactions;
    step("commit", plan[4].title, plan[4].detail, "ok");

    return {
      transferId,
      amount,
      steps,
      from: { _id: source._id, name: source.name, balance: draftSource.balance },
      to: { _id: target._id, name: target.name, balance: draftTarget.balance },
    };
  });
}
