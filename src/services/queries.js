// Internal helpers shared by several services (not exported from index.js).
import { db } from "./db.js";
import { ServiceError } from "./errors.js";
import { monthKey } from "../utils/dates.js";

export function userAccounts(userId) {
  return db.accounts.filter((a) => a.userId === userId);
}

export function userAccountIds(userId) {
  return new Set(userAccounts(userId).map((a) => a._id));
}

/** Returns the account if it exists and belongs to the user, otherwise throws. */
export function findOwnedAccount(userId, accountId) {
  const account = db.accounts.find((a) => a._id === accountId && a.userId === userId);
  if (!account) throw new ServiceError("ACCOUNT_NOT_FOUND", "This account does not exist.");
  return account;
}

/** Real spending and income of a month: transfers between own accounts are ignored. */
export function monthTotals(userId, month) {
  const ids = userAccountIds(userId);
  let income = 0;
  let expenses = 0;
  const expensesByCategory = {};
  for (const t of db.transactions) {
    if (!ids.has(t.accountId) || t.transferId || monthKey(t.date) !== month) continue;
    if (t.type === "credit") {
      income += t.amount;
    } else {
      expenses += t.amount;
      expensesByCategory[t.categoryId] = (expensesByCategory[t.categoryId] || 0) + t.amount;
    }
  }
  return { income, expenses, expensesByCategory };
}

export function categoryName(categoryId) {
  const category = db.categories.find((c) => c._id === categoryId);
  return category ? category.name : "Unknown";
}
