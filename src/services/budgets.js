import { request } from "./api.js";

/** Budgets of one month with what has been spent, plus the spending that has no budget. */
export function getBudgets(month) {
  return request("GET", "/budgets", { query: { month } });
}

/** Creates the budget of a category for a month, or changes its limit. */
export function setBudget({ categoryId, month, limit }) {
  return request("PUT", "/budgets", { body: { categoryId, month, limit } });
}

export function removeBudget(budgetId) {
  return request("DELETE", "/budgets/" + encodeURIComponent(budgetId));
}
