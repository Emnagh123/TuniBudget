// Month summary, spending by category and balance history, computed on the server.
// Transfers between the user's own accounts are not income or spending, so they are left out.
import express from "express";
import { collections } from "../db.js";
import * as v from "../validate.js";
import { ApiError } from "../errors.js";
import { perksOf } from "../plans.js";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

export async function categoryNames() {
  const list = await collections.categories.find({}, { projection: { name: 1 } }).toArray();
  return Object.fromEntries(list.map((c) => [c._id, c.name]));
}

/** Income, expenses and expenses per category of one month, added up by MongoDB. */
export async function monthTotals(userId, month) {
  const { start, end } = monthRange(month);
  const rows = await collections.transactions
    .aggregate([
      { $match: { userId, transferId: null, date: { $gte: start, $lt: end } } },
      { $group: { _id: { type: "$type", categoryId: "$categoryId" }, total: { $sum: "$amount" } } },
    ])
    .toArray();
  let income = 0;
  let expenses = 0;
  const expensesByCategory = {};
  for (const row of rows) {
    if (row._id.type === "credit") {
      income += row.total;
    } else {
      expenses += row.total;
      expensesByCategory[row._id.categoryId] = (expensesByCategory[row._id.categoryId] || 0) + row.total;
    }
  }
  return { income, expenses, expensesByCategory };
}

export function analyticsRoutes() {
  const router = express.Router();

  router.get("/summary", async (req, res) => {
    const month = v.month(req.query.month);
    const before = previousMonth(month);
    const [current, previous] = await Promise.all([monthTotals(req.user._id, month), monthTotals(req.user._id, before)]);
    res.json({
      month,
      income: current.income,
      expenses: current.expenses,
      net: current.income - current.expenses,
      spentShare: current.income > 0 ? current.expenses / current.income : null,
      previous: { month: before, income: previous.income, expenses: previous.expenses },
    });
  });

  router.get("/spending", async (req, res) => {
    const month = v.month(req.query.month);
    const [{ expensesByCategory, expenses }, names] = await Promise.all([monthTotals(req.user._id, month), categoryNames()]);
    const list = Object.entries(expensesByCategory)
      .map(([categoryId, total]) => ({ categoryId, name: names[categoryId] || "Unknown", total, share: expenses ? total / expenses : 0 }))
      .sort((a, b) => b.total - a.total);
    res.json(list);
  });

  // Balance at the end of each of the last `days` days: start from today's balance and undo each day.
  router.get("/balance-history", async (req, res) => {
    const userId = req.user._id;
    const days = v.intParam(req.query.days, { fallback: 90, min: 7, max: 366 });
    const maxDays = Math.max(...perksOf(req.user).chartDays);
    if (days > maxDays) throw new ApiError("PLAN_LIMIT", "The 365-day chart is a Premium feature.", { feature: "chartDays" });
    const accountId = v.optionalId(req.query.accountId, { prefix: "acc", code: "ACCOUNT_NOT_FOUND", message: "This account does not exist." });

    const accounts = await collections.accounts.find(accountId ? { userId, _id: accountId } : { userId }).toArray();
    const ids = accounts.map((a) => a._id);
    const current = accounts.reduce((sum, a) => sum + a.balance, 0);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    const movements = await collections.transactions
      .find({ userId, accountId: { $in: ids }, date: { $gte: since } }, { projection: { type: 1, amount: 1, date: 1 } })
      .toArray();

    const netByDay = {};
    for (const t of movements) {
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
    res.json({ points, current, min: Math.min(...balances), max: Math.max(...balances) });
  });

  return router;
}
