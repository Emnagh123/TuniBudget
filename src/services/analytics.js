import { db } from "./db.js";
import { delay } from "./errors.js";
import { requireUserId } from "./session.js";
import { categoryName, monthTotals, userAccountIds, userAccounts } from "./queries.js";
import { addMonths, dayKey } from "../utils/dates.js";

/** Income, expenses and what is left for a month, plus the previous month for comparison. */
export async function getMonthSummary(month) {
  const userId = requireUserId();
  await delay();
  const current = monthTotals(userId, month);
  const previousMonth = addMonths(month, -1);
  const previous = monthTotals(userId, previousMonth);
  return {
    month,
    income: current.income,
    expenses: current.expenses,
    net: current.income - current.expenses,
    spentShare: current.income > 0 ? current.expenses / current.income : null,
    previous: { month: previousMonth, income: previous.income, expenses: previous.expenses },
  };
}

/** Expenses of a month grouped by category, biggest first. */
export async function getSpendingByCategory(month) {
  const userId = requireUserId();
  await delay();
  const { expensesByCategory, expenses } = monthTotals(userId, month);
  return Object.entries(expensesByCategory)
    .map(([categoryId, total]) => ({
      categoryId,
      name: categoryName(categoryId),
      total,
      share: expenses ? total / expenses : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Balance at the end of each of the last `days` days, for all accounts or for one account.
 * It starts from today's balance and goes back by undoing each day's movements.
 */
export async function getBalanceHistory({ days = 90, accountId = "" } = {}) {
  const userId = requireUserId();
  await delay();
  const ids = userAccountIds(userId);
  const accounts = userAccounts(userId).filter((a) => !accountId || a._id === accountId);
  const selected = new Set(accounts.map((a) => a._id));
  const current = accounts.reduce((sum, a) => sum + a.balance, 0);

  const netByDay = {};
  for (const t of db.transactions) {
    if (!ids.has(t.accountId) || !selected.has(t.accountId)) continue;
    const key = dayKey(t.date);
    netByDay[key] = (netByDay[key] || 0) + (t.type === "credit" ? t.amount : -t.amount);
  }

  const points = [];
  let balance = current;
  const day = new Date();
  for (let i = 0; i < days; i += 1) {
    const key = dayKey(day);
    points.push({ date: key, balance });
    balance -= netByDay[key] || 0;
    day.setDate(day.getDate() - 1);
  }
  points.reverse();

  const balances = points.map((p) => p.balance);
  return { points, current, min: Math.min(...balances), max: Math.max(...balances) };
}
