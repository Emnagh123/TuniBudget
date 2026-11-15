import { useEffect, useState } from "react";
import { addOperation, getAccounts, getCategories, getTransactions } from "../services/index.js";
import { formatDay } from "../utils/dates.js";
import { formatMillimes, parseTndToMillimes } from "../utils/money.js";
import { Amount } from "../components/Money.jsx";
import Icon from "../components/Icon.jsx";
import Pagination from "../components/Pagination.jsx";
import { EmptyState, ErrorState, Loading } from "../components/StateMessage.jsx";

const PAGE_SIZE = 10;
const NO_FILTERS = { accountId: "", type: "all", categoryId: "", from: "", to: "", min: "", max: "" };
const EMPTY_FORM = { accountId: "", kind: "expense", categoryId: "", amount: "", description: "" };

export default function HistoryPage({ version, onChange, notify }) {
  const [meta, setMeta] = useState(null); // { accounts, categories }
  const [metaError, setMetaError] = useState("");

  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [listError, setListError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMetaError("");
    Promise.all([getAccounts(), getCategories()])
      .then(([accounts, categories]) => {
        if (!cancelled) setMeta({ accounts, categories });
      })
      .catch((err) => {
        if (!cancelled) setMetaError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  // Amount filters: an empty box means "no limit"; an invalid text is reported and ignored.
  const minAmount = filters.min.trim() === "" ? null : parseTndToMillimes(filters.min);
  const maxAmount = filters.max.trim() === "" ? null : parseTndToMillimes(filters.max);
  const minInvalid = filters.min.trim() !== "" && minAmount === null;
  const maxInvalid = filters.max.trim() !== "" && maxAmount === null;
  const rangeInvalid = filters.from !== "" && filters.to !== "" && filters.from > filters.to;

  const query = {
    accountId: filters.accountId,
    type: filters.type,
    categoryId: filters.categoryId,
    from: rangeInvalid ? "" : filters.from,
    to: rangeInvalid ? "" : filters.to,
    minAmount,
    maxAmount,
    page,
    limit: PAGE_SIZE,
  };
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setListError("");
    getTransactions(query)
      .then((result) => {
        if (cancelled) return;
        setList(result);
        if (result.page !== page) setPage(result.page);
      })
      .catch((err) => {
        if (!cancelled) setListError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, version, attempt]);

  if (metaError && !meta) return <ErrorState message={metaError} onRetry={() => setAttempt(attempt + 1)} />;
  if (!meta) return <Loading label="Loading your history" />;

  const { accounts, categories } = meta;
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const accountName = (id) => (accounts.find((a) => a._id === id) || {}).name || "";
  const categoryLabel = (id) => (categories.find((c) => c._id === id) || {}).name || "";
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const formAccountId = activeAccounts.some((a) => a._id === form.accountId) ? form.accountId : activeAccounts[0] ? activeAccounts[0]._id : "";
  const formCategories = categories.filter((c) => c.kind === form.kind);

  function setFilter(field, value) {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  }

  async function submitOperation(event) {
    event.preventDefault();
    setFormError("");
    const amount = parseTndToMillimes(form.amount);
    if (form.amount.trim() === "") return setFormError("Enter an amount.");
    if (amount === null || amount <= 0) return setFormError("Enter a valid amount greater than 0, with up to 3 decimals.");
    if (!form.categoryId) return setFormError("Choose a category.");
    setSaving(true);
    try {
      await addOperation({ accountId: formAccountId, kind: form.kind, amount, categoryId: form.categoryId, description: form.description });
      notify("success", (form.kind === "income" ? "Income" : "Expense") + " of " + formatMillimes(amount) + " TND added.");
      setForm({ ...EMPTY_FORM, accountId: formAccountId, kind: form.kind });
      setPage(1);
      onChange();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">Every movement on your accounts. The ledger is append-only: an entry can never be edited or deleted.</p>
        </div>
      </div>

      <div className="columns">
        <div className="grow-wide stack">
          <section className="panel" aria-labelledby="filters-title">
            <div className="panel__head">
              <h2 className="panel__title" id="filters-title" style={{ fontSize: 18 }}>
                Filters
              </h2>
              {filtersActive && (
                <button type="button" className="link-button" onClick={() => { setFilters(NO_FILTERS); setPage(1); }}>
                  Clear filters
                </button>
              )}
            </div>
            <div className="filters">
              <label className="field">
                Account
                <select className="input" value={filters.accountId} onChange={(e) => setFilter("accountId", e.target.value)}>
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                      {a.status === "closed" ? " (closed)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Type
                <select className="input" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
                  <option value="all">All movements</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfers</option>
                </select>
              </label>
              <label className="field">
                Category
                <select className="input" value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                From
                <input className="input" type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} aria-invalid={rangeInvalid ? "true" : "false"} />
              </label>
              <label className="field">
                To
                <input className="input" type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} aria-invalid={rangeInvalid ? "true" : "false"} />
              </label>
              <div className="filters__amounts">
                <label className="field">
                  Minimum amount
                  <span className="input-money">
                    <input className="input num" inputMode="decimal" value={filters.min} onChange={(e) => setFilter("min", e.target.value)} placeholder="0.000" aria-invalid={minInvalid ? "true" : "false"} />
                    <span className="input-money__unit">TND</span>
                  </span>
                </label>
                <label className="field">
                  Maximum amount
                  <span className="input-money">
                    <input className="input num" inputMode="decimal" value={filters.max} onChange={(e) => setFilter("max", e.target.value)} placeholder="No limit" aria-invalid={maxInvalid ? "true" : "false"} />
                    <span className="input-money__unit">TND</span>
                  </span>
                </label>
              </div>
            </div>
            {(rangeInvalid || minInvalid || maxInvalid) && (
              <p className="form-error" role="alert" style={{ marginTop: 14 }}>
                <Icon name="warning" />
                {rangeInvalid ? "The start date is after the end date, so the dates are ignored." : "An amount filter is not a valid number, so it is ignored."}
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="ledger-title">
            <h2 className="sr-only" id="ledger-title">
              Movements
            </h2>
            {listError && !list ? (
              <ErrorState message={listError} onRetry={() => setAttempt(attempt + 1)} />
            ) : !list ? (
              <Loading label="Loading movements" />
            ) : list.total === 0 ? (
              <EmptyState title="No movement matches these filters">
                {filtersActive ? "Try removing a filter to see more." : "Add an expense or an income to start your history."}
              </EmptyState>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Description</th>
                        <th scope="col">Account</th>
                        <th scope="col">Category</th>
                        <th scope="col" className="right">
                          Amount (TND)
                        </th>
                        <th scope="col" className="right">
                          Balance after
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((t) => (
                        <tr key={t._id}>
                          <td className="num nowrap">{formatDay(t.date)}</td>
                          <td>{t.description}</td>
                          <td>{accountName(t.accountId)}</td>
                          <td>
                            <span className="tag">{categoryLabel(t.categoryId)}</span>
                          </td>
                          <td className="right">
                            <Amount millimes={t.amount} type={t.type} neutral={Boolean(t.transferId)} />
                          </td>
                          <td className="right num muted">{formatMillimes(t.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={list.page} totalPages={list.totalPages} total={list.total} limit={list.limit} onChange={setPage} />
              </>
            )}
          </section>
        </div>

        <form className="panel side-form" onSubmit={submitOperation} noValidate aria-labelledby="operation-title">
          <div>
            <h2 className="panel__title" id="operation-title">
              Add an operation
            </h2>
            <p className="panel__subtitle">An expense or an income on one of your accounts.</p>
          </div>

          <div className="segmented" role="group" aria-label="Kind of operation">
            <button type="button" className="segmented__option" aria-pressed={form.kind === "expense"} onClick={() => setForm({ ...form, kind: "expense", categoryId: "" })}>
              Expense
            </button>
            <button type="button" className="segmented__option" aria-pressed={form.kind === "income"} onClick={() => setForm({ ...form, kind: "income", categoryId: "" })}>
              Income
            </button>
          </div>

          <label className="field">
            Account
            <select className="input" value={formAccountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              {activeAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Amount
            <span className="input-money">
              <input className="input num" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.000" />
              <span className="input-money__unit">TND</span>
            </span>
          </label>

          <label className="field">
            Category
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Choose a category</option>
              {formCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Description
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={form.kind === "expense" ? "For example: groceries" : "For example: freelance job"} />
          </label>

          {formError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={saving || activeAccounts.length === 0}>
            {saving ? "Adding…" : form.kind === "expense" ? "Add the expense" : "Add the income"}
          </button>
        </form>
      </div>
    </>
  );
}
