// The ledger is append-only: there is no function to edit or delete a transaction.
import { request } from "./api.js";

export function getCategories() {
  return request("GET", "/categories");
}

/**
 * Filters, sorts (newest first) and paginates the ledger, on the server.
 * type: "all" | "expense" | "income" | "transfer". Amounts are in millimes.
 */
export function getTransactions({ accountId = "", type = "all", categoryId = "", from = "", to = "", minAmount = null, maxAmount = null, page = 1, limit = 10 } = {}) {
  return request("GET", "/transactions", { query: { accountId, type, categoryId, from, to, minAmount, maxAmount, page, limit } });
}

/** Adds an expense or an income to an account. The server refuses an expense higher than the balance. */
export function addOperation({ accountId, kind, amount, categoryId, description }) {
  return request("POST", "/transactions", { body: { accountId, kind, amount, categoryId, description }, idempotent: true });
}
