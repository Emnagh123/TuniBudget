import { db, nextId } from "./db.js";
import { ServiceError, delay, validationError, withLock } from "./errors.js";
import { requireUserId } from "./session.js";
import { categoryName, monthTotals } from "./queries.js";

// near: from 80 % of the limit. exceeded: from 100 %.
function budgetStatus(spent, limit) {
  const ratio = spent / limit;
  if (ratio >= 1) return "exceeded";
  if (ratio >= 0.8) return "near";
  return "ok";
}

/** Budgets of one month with what has been spent, plus the spending that has no budget. */
export async function getBudgets(month) {
  const userId = requireUserId();
  await delay();
  const { expensesByCategory } = monthTotals(userId, month);

  const items = db.budgets
    .filter((b) => b.userId === userId && b.month === month)
    .map((b) => {
      const spent = expensesByCategory[b.categoryId] || 0;
      return {
        _id: b._id,
        categoryId: b.categoryId,
        categoryName: categoryName(b.categoryId),
        limit: b.limit,
        spent,
        remaining: b.limit - spent,
        percent: Math.floor((spent / b.limit) * 100),
        status: budgetStatus(spent, b.limit),
      };
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  const budgeted = new Set(items.map((i) => i.categoryId));
  const unbudgeted = Object.entries(expensesByCategory)
    .filter(([categoryId]) => !budgeted.has(categoryId))
    .map(([categoryId, spent]) => ({ categoryId, categoryName: categoryName(categoryId), spent }))
    .sort((a, b) => b.spent - a.spent);

  const totalLimit = items.reduce((sum, i) => sum + i.limit, 0);
  const totalSpent = items.reduce((sum, i) => sum + i.spent, 0);
  return {
    month,
    items,
    unbudgeted,
    totals: {
      limit: totalLimit,
      spent: totalSpent,
      percent: totalLimit ? Math.floor((totalSpent / totalLimit) * 100) : 0,
    },
  };
}

/** Creates the budget of a category for a month, or changes its limit. */
export function setBudget({ categoryId, month, limit }) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    if (!/^\d{4}-\d{2}$/.test(String(month))) throw validationError("Choose a month.");
    const category = db.categories.find((c) => c._id === categoryId);
    if (!category || category.kind !== "expense") {
      throw new ServiceError("CATEGORY_NOT_FOUND", "Choose an expense category.");
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new ServiceError("INVALID_AMOUNT", "The limit must be greater than 0.");
    }
    const existing = db.budgets.find((b) => b.userId === userId && b.categoryId === categoryId && b.month === month);
    if (existing) {
      db.budgets = db.budgets.map((b) => (b._id === existing._id ? { ...b, limit } : b));
      return { ...existing, limit };
    }
    const budget = { _id: nextId("bud"), userId, categoryId, month, limit };
    db.budgets = [...db.budgets, budget];
    return { ...budget };
  });
}

export function removeBudget(budgetId) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    const budget = db.budgets.find((b) => b._id === budgetId && b.userId === userId);
    if (!budget) throw new ServiceError("VALIDATION_ERROR", "This budget does not exist.");
    db.budgets = db.budgets.filter((b) => b._id !== budgetId);
    return { removed: budgetId };
  });
}
