import { useEffect, useState } from "react";
import { copyPreviousBudgets, getBudgets, getCategories, removeBudget, setBudget } from "../services/index.js";
import { addMonths, currentMonthKey, monthLabel, monthName } from "../utils/dates.js";
import { formatMillimes, formatTnd, parseTndToMillimes } from "../utils/money.js";
import BudgetStatus from "../components/BudgetStatus.jsx";
import Icon from "../components/Icon.jsx";
import Meter from "../components/Meter.jsx";
import PremiumHint from "../components/PremiumHint.jsx";
import { EmptyState, ErrorState, Loading } from "../components/StateMessage.jsx";

const MONTHS_BACK = 11;
const MONTHS_AHEAD = 1;

export default function BudgetsPage({ user, version, onChange, notify, goTo }) {
  const thisMonth = currentMonthKey();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState(null); // { budgets, categories }
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [form, setForm] = useState({ categoryId: "", limit: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [editing, setEditing] = useState(null); // { id, categoryId, limit }
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([getBudgets(month), getCategories()])
      .then(([budgets, categories]) => {
        if (!cancelled) setData({ budgets, categories });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, version, attempt]);

  // The free plan only plans the current month (the server refuses the others).
  const anyMonth = user.perks.budgetsAnyMonth;
  const canGoBack = anyMonth && month > addMonths(thisMonth, -MONTHS_BACK);
  const canGoForward = anyMonth && month < addMonths(thisMonth, MONTHS_AHEAD);

  function changeMonth(delta) {
    setMonth(addMonths(month, delta));
    setEditing(null);
    setEditError("");
    setFormError("");
  }

  const monthSwitcher = (
    <div className="month-switcher" role="group" aria-label="Month">
      <button type="button" className="btn btn--small" onClick={() => changeMonth(-1)} disabled={!canGoBack} aria-label="Previous month">
        <Icon name="chevronLeft" size={14} />
      </button>
      <span className="month-switcher__label" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button type="button" className="btn btn--small" onClick={() => changeMonth(1)} disabled={!canGoForward} aria-label="Next month">
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );

  if (error && !data) return <ErrorState message={error} onRetry={() => setAttempt(attempt + 1)} />;
  if (!data) return <Loading label="Loading your budgets" />;

  const { budgets, categories } = data;
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const exceeded = budgets.items.filter((b) => b.status === "exceeded");
  const near = budgets.items.filter((b) => b.status === "near");

  async function submitBudget(event) {
    event.preventDefault();
    setFormError("");
    if (!form.categoryId) return setFormError("Choose a category.");
    const limit = parseTndToMillimes(form.limit);
    if (form.limit.trim() === "") return setFormError("Enter a monthly limit.");
    if (limit === null || limit <= 0) return setFormError("Enter a valid limit greater than 0, with up to 3 decimals.");
    setSaving(true);
    try {
      await setBudget({ categoryId: form.categoryId, month, limit });
      const name = expenseCategories.find((c) => c._id === form.categoryId).name;
      notify("success", "Budget saved: " + name + ", " + formatTnd(limit) + " for " + monthName(month) + ".");
      setForm({ categoryId: "", limit: "" });
      onChange();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    setEditError("");
    const limit = parseTndToMillimes(editing.limit);
    if (limit === null || limit <= 0) return setEditError("Enter a valid limit greater than 0.");
    try {
      await setBudget({ categoryId: editing.categoryId, month, limit });
      notify("success", "Limit updated.");
      setEditing(null);
      onChange();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleCopyPrevious() {
    setCopying(true);
    try {
      const result = await copyPreviousBudgets(month);
      if (result.found === 0) notify("info", "There were no budgets in " + monthName(addMonths(month, -1)) + " to copy.");
      else notify("success", result.copied + " budget" + (result.copied === 1 ? "" : "s") + " copied from " + monthName(addMonths(month, -1)) + ".");
      onChange();
    } catch (err) {
      notify("error", err.message);
    } finally {
      setCopying(false);
    }
  }

  async function handleRemove(budget) {
    try {
      await removeBudget(budget._id);
      notify("success", "Budget \"" + budget.categoryName + "\" removed.");
      onChange();
    } catch (err) {
      notify("error", err.message);
    }
  }

  // "Set a limit" next to a category without a budget: fill in the form, then bring it on screen
  // and put the cursor in the limit box, so the user sees what happened (the form can be off-screen).
  function startBudgetFor(categoryId) {
    setForm({ categoryId, limit: "" });
    setFormError("");
    window.requestAnimationFrame(() => {
      const input = document.getElementById("budget-limit");
      if (!input) return;
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    });
  }

  const hasBudgets = budgets.items.length > 0;
  const totalPercent = budgets.totals.percent;
  const totalStatus = totalPercent >= 100 ? "exceeded" : totalPercent >= 80 ? "near" : "ok";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
        </div>
        <div className="page-actions">
          {user.perks.copyBudgets ? (
            <button type="button" className="btn btn--small" onClick={handleCopyPrevious} disabled={copying}>
              {copying ? "Copying…" : "Copy last month"}
            </button>
          ) : (
            <button type="button" className="btn btn--small btn--locked" onClick={() => goTo("premium")} title="Premium feature">
              <Icon name="lock" />
              Copy last month
            </button>
          )}
          {monthSwitcher}
        </div>
      </div>

      {!anyMonth && (
        <div style={{ marginBottom: 20 }}>
          <PremiumHint goTo={goTo} compact>
            The free plan budgets the current month. Premium plans any month.
          </PremiumHint>
        </div>
      )}

      {(exceeded.length > 0 || near.length > 0) && (
        <div className="stack" style={{ marginBottom: 20 }}>
          {exceeded.length > 0 && (
            <p className="notice notice--error" role="status">
              <Icon name="warning" />
              <span>
                {exceeded.map((b) => b.categoryName + " is over its limit by " + formatTnd(-b.remaining)).join(". ")}.
              </span>
            </p>
          )}
          {near.length > 0 && (
            <p className="notice notice--near" role="status">
              <Icon name="clock" />
              <span>
                {near.map((b) => b.categoryName + " has " + formatTnd(b.remaining) + " left").join(". ")}.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="columns">
        <div className="grow-wide stack">
          {hasBudgets && (
            <section className="panel" aria-labelledby="total-title">
              <h2 className="panel__title" id="total-title" style={{ fontSize: 18 }}>
                {monthLabel(month)} in total
              </h2>
              <div className="total-line">
                <p className="num total-line__value">
                  {formatMillimes(budgets.totals.spent)} <span className="muted">of {formatMillimes(budgets.totals.limit)} TND</span>
                </p>
                <BudgetStatus status={totalStatus} percent={totalPercent} />
              </div>
              <Meter percent={totalPercent} status={totalStatus} label={totalPercent + " % of the total budget used"} />
            </section>
          )}

          {!hasBudgets ? (
            <section className="panel">
              <EmptyState title={"No budget for " + monthLabel(month)}>Choose a category and a monthly limit in the form to create your first one.</EmptyState>
            </section>
          ) : (
            <div className="cards-grid">
              {budgets.items.map((budget) => {
                const isEditing = editing && editing.id === budget._id;
                return (
                  <article key={budget._id} className="panel budget-card" aria-labelledby={"bud-" + budget._id}>
                    <div className="budget-card__head">
                      <h2 className="panel__title" id={"bud-" + budget._id} style={{ fontSize: 18 }}>
                        {budget.categoryName}
                      </h2>
                      <BudgetStatus status={budget.status} percent={budget.percent} />
                    </div>
                    <Meter percent={budget.percent} status={budget.status} label={budget.categoryName + ", " + budget.percent + " % of the budget used"} />
                    <p className="num budget-card__amounts">
                      {formatMillimes(budget.spent)} <span className="muted">of {formatMillimes(budget.limit)} TND</span>
                    </p>
                    <p className={"small " + (budget.remaining < 0 ? "neg" : "muted")}>
                      {budget.remaining < 0 ? formatTnd(-budget.remaining) + " over the limit" : formatTnd(budget.remaining) + " left"}
                    </p>

                    {isEditing ? (
                      <form className="budget-card__edit" onSubmit={submitEdit}>
                        <label className="field">
                          <span className="sr-only">New monthly limit</span>
                          <span className="input-money">
                            <input className="input num" inputMode="decimal" value={editing.limit} onChange={(e) => setEditing({ ...editing, limit: e.target.value })} autoFocus aria-invalid={editError ? "true" : "false"} />
                            <span className="input-money__unit">TND</span>
                          </span>
                        </label>
                        <div className="row">
                          <button type="submit" className="btn btn--small btn--primary">
                            Save
                          </button>
                          <button type="button" className="btn btn--small" onClick={() => { setEditing(null); setEditError(""); }}>
                            Cancel
                          </button>
                        </div>
                        {editError && (
                          <p className="form-error" role="alert">
                            <Icon name="warning" />
                            {editError}
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn--small"
                          onClick={() => { setEditing({ id: budget._id, categoryId: budget.categoryId, limit: formatMillimes(budget.limit).replace(/,/g, "") }); setEditError(""); }}
                        >
                          Change limit
                        </button>
                        <button type="button" className="btn btn--small" onClick={() => handleRemove(budget)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {budgets.unbudgeted.length > 0 && (
            <section className="panel" aria-labelledby="unbudgeted-title">
              <h2 className="panel__title" id="unbudgeted-title" style={{ fontSize: 18 }}>
                Spending without a budget
              </h2>
              <ul className="closed-list">
                {budgets.unbudgeted.map((item) => (
                  <li key={item.categoryId} className="closed-list__row">
                    <div>
                      <p style={{ fontWeight: 600 }}>{item.categoryName}</p>
                      <p className="muted small num">{formatTnd(item.spent)} spent</p>
                    </div>
                    <button type="button" className="btn btn--small" onClick={() => startBudgetFor(item.categoryId)}>
                      Set a limit
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <form className="panel side-form" onSubmit={submitBudget} noValidate aria-labelledby="budget-form-title">
          <div>
            <h2 className="panel__title" id="budget-form-title">
              Set a budget
            </h2>
          </div>
          <label className="field">
            Category
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Choose a category</option>
              {expenseCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Monthly limit
            <span className="input-money">
              <input id="budget-limit" className="input num" inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder="0.000" />
              <span className="input-money__unit">TND</span>
            </span>
          </label>
          {formError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
            {saving ? "Saving…" : "Save the budget"}
          </button>
        </form>
      </div>
    </>
  );
}
