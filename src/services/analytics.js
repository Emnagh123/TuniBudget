import { request } from "./api.js";

/** Income, expenses and what is left for a month, plus the previous month for comparison. */
export function getMonthSummary(month) {
  return request("GET", "/analytics/summary", { query: { month } });
}

/** Expenses of a month grouped by category, biggest first. */
export function getSpendingByCategory(month) {
  return request("GET", "/analytics/spending", { query: { month } });
}

/** Balance at the end of each of the last `days` days, for all accounts or for one account. */
export function getBalanceHistory({ days = 90, accountId = "" } = {}) {
  return request("GET", "/analytics/balance-history", { query: { days, accountId } });
}
