// Monthly budgets per expense category.
import express from "express";
import { collections } from "../db.js";
import { ApiError } from "../errors.js";
import { newId } from "../security/tokens.js";
import * as v from "../validate.js";
import { categoryNames, monthTotals } from "./analytics.js";
import { monthKeyOf, perksOf } from "../plans.js";

// Free users plan the current month only; Premium users any month (plans.js).
function checkMonthAllowed(user, month) {
  if (!perksOf(user).budgetsAnyMonth && month !== monthKeyOf()) {
    throw new ApiError("PLAN_LIMIT", "Budgets for other months are a Premium feature.", { feature: "budgetsAnyMonth" });
  }
}

function previousMonthOf(month) {
  const [y, m] = month.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 2, 1));
}

// near: from 80 % of the limit. exceeded: from 100 %.
function budgetStatus(spent, limit) {
  const ratio = spent / limit;
  if (ratio >= 1) return "exceeded";
  if (ratio >= 0.8) return "near";
  return "ok";
}

export function budgetRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const userId = req.user._id;
    const month = v.month(req.query.month);
    checkMonthAllowed(req.user, month);
    const [{ expensesByCategory }, names, budgets] = await Promise.all([
      monthTotals(userId, month),
      categoryNames(),
      collections.budgets.find({ userId, month }).toArray(),
    ]);
    const name = (id) => names[id] || "Unknown";

    const items = budgets
      .map((b) => {
        const spent = expensesByCategory[b.categoryId] || 0;
        return {
          _id: b._id,
          categoryId: b.categoryId,
          categoryName: name(b.categoryId),
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
      .map(([categoryId, spent]) => ({ categoryId, categoryName: name(categoryId), spent }))
      .sort((a, b) => b.spent - a.spent);

    const totalLimit = items.reduce((sum, i) => sum + i.limit, 0);
    const totalSpent = items.reduce((sum, i) => sum + i.spent, 0);
    res.json({
      month,
      items,
      unbudgeted,
      totals: { limit: totalLimit, spent: totalSpent, percent: totalLimit ? Math.floor((totalSpent / totalLimit) * 100) : 0 },
    });
  });

  // Creates the budget of a category for a month, or changes its limit (one write, thanks to upsert).
  router.put("/", async (req, res) => {
    const body = v.onlyFields(req.body, ["categoryId", "month", "limit"]);
    const month = v.month(body.month);
    checkMonthAllowed(req.user, month);
    const categoryId = v.id(body.categoryId, { prefix: "cat", code: "CATEGORY_NOT_FOUND", message: "Choose an expense category." });
    const limit = v.millimes(body.limit, { message: "The limit must be greater than 0." });
    const category = await collections.categories.findOne({ _id: categoryId });
    if (!category || category.kind !== "expense") throw new ApiError("CATEGORY_NOT_FOUND", "Choose an expense category.");

    const userId = req.user._id;
    const budget = await collections.budgets.findOneAndUpdate(
      { userId, categoryId, month },
      { $set: { limit }, $setOnInsert: { _id: newId("bud") } },
      { upsert: true, returnDocument: "after" }
    );
    res.json({ _id: budget._id, categoryId, month, limit });
  });

  // Premium: copies last month's limits into this month. Budgets already set this month are kept.
  router.post("/copy-previous", async (req, res) => {
    if (!perksOf(req.user).copyBudgets) {
      throw new ApiError("PLAN_LIMIT", "Copying last month's budgets is a Premium feature.", { feature: "copyBudgets" });
    }
    const body = v.onlyFields(req.body, ["month"]);
    const month = v.month(body.month);
    const userId = req.user._id;
    const previous = await collections.budgets.find({ userId, month: previousMonthOf(month) }).toArray();
    let copied = 0;
    for (const b of previous) {
      const result = await collections.budgets.updateOne(
        { userId, categoryId: b.categoryId, month },
        { $setOnInsert: { _id: newId("bud"), limit: b.limit } },
        { upsert: true }
      );
      if (result.upsertedCount) copied += 1;
    }
    res.json({ month, copied, found: previous.length });
  });

  router.delete("/:budgetId", async (req, res) => {
    const budgetId = v.id(req.params.budgetId, { prefix: "bud", code: "BUDGET_NOT_FOUND", message: "This budget does not exist." });
    const result = await collections.budgets.deleteOne({ _id: budgetId, userId: req.user._id });
    if (result.deletedCount === 0) throw new ApiError("BUDGET_NOT_FOUND", "This budget does not exist.");
    res.json({ removed: budgetId });
  });

  return router;
}
