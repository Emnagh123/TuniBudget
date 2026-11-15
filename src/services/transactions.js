// The ledger is append-only: there is no function to edit or delete a transaction.
import { db, nextId, nextSeq } from "./db.js";
import { ServiceError, delay, validationError, withLock } from "./errors.js";
import { requireUserId } from "./session.js";
import { findOwnedAccount, userAccountIds } from "./queries.js";
import { endOfDay, startOfDay } from "../utils/dates.js";

export async function getCategories() {
  requireUserId();
  await delay();
  return db.categories.map((c) => ({ ...c }));
}

/**
 * Filters, sorts (newest first) and paginates the ledger.
 * type: "all" | "expense" | "income" | "transfer". Amounts are in millimes.
 */
export async function getTransactions({
  accountId = "",
  type = "all",
  categoryId = "",
  from = "",
  to = "",
  minAmount = null,
  maxAmount = null,
  page = 1,
  limit = 10,
} = {}) {
  const userId = requireUserId();
  await delay();
  const ids = userAccountIds(userId);
  if (accountId && !ids.has(accountId)) {
    throw new ServiceError("ACCOUNT_NOT_FOUND", "This account does not exist.");
  }

  const fromDate = from ? startOfDay(from) : null;
  const toDate = to ? endOfDay(to) : null;

  const matches = db.transactions.filter((t) => {
    if (!ids.has(t.accountId)) return false;
    if (accountId && t.accountId !== accountId) return false;
    if (type === "expense" && !(t.type === "debit" && !t.transferId)) return false;
    if (type === "income" && !(t.type === "credit" && !t.transferId)) return false;
    if (type === "transfer" && !t.transferId) return false;
    if (categoryId && t.categoryId !== categoryId) return false;
    if (fromDate && new Date(t.date) < fromDate) return false;
    if (toDate && new Date(t.date) > toDate) return false;
    if (minAmount !== null && t.amount < minAmount) return false;
    if (maxAmount !== null && t.amount > maxAmount) return false;
    return true;
  });

  matches.sort((a, b) => new Date(b.date) - new Date(a.date) || b.seq - a.seq);

  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const items = matches.slice((safePage - 1) * limit, safePage * limit).map((t) => ({ ...t }));
  return { items, total, page: safePage, limit, totalPages };
}

/** Adds an expense or an income to an account. An expense can never exceed the balance. */
export function addOperation({ accountId, kind, amount, categoryId, description }) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    const account = findOwnedAccount(userId, accountId);
    if (account.status === "closed") throw new ServiceError("ACCOUNT_CLOSED", "This account is closed.");
    if (kind !== "expense" && kind !== "income") throw validationError("Choose expense or income.");
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ServiceError("INVALID_AMOUNT", "Enter an amount greater than 0.");
    }
    const category = db.categories.find((c) => c._id === categoryId);
    if (!category || category.kind !== kind) {
      throw new ServiceError("CATEGORY_NOT_FOUND", "Choose a category that matches the operation.");
    }
    const text = String(description || "").trim();
    if (text.length < 2) throw validationError("Add a short description.");
    if (kind === "expense" && account.balance < amount) {
      throw new ServiceError("INSUFFICIENT_FUNDS", "This expense is higher than the account balance.");
    }

    const newBalance = account.balance + (kind === "income" ? amount : -amount);
    const transaction = {
      _id: nextId("txn"),
      accountId,
      type: kind === "income" ? "credit" : "debit",
      amount,
      categoryId,
      description: text,
      date: new Date().toISOString(),
      transferId: null,
      balanceAfter: newBalance,
      seq: nextSeq(),
    };
    db.accounts = db.accounts.map((a) => (a._id === accountId ? { ...a, balance: newBalance } : a));
    db.transactions = [...db.transactions, transaction];
    return { ...transaction };
  });
}
