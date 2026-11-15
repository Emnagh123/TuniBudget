import { useEffect, useState } from "react";
import { closeAccount, createAccount, getAccounts, renameAccount } from "../services/index.js";
import { formatDayYear } from "../utils/dates.js";
import { formatTnd, parseTndToMillimes } from "../utils/money.js";
import { BigMoney } from "../components/Money.jsx";
import Icon from "../components/Icon.jsx";
import { ErrorState, Loading } from "../components/StateMessage.jsx";

const TYPE_LABELS = { checking: "Checking", savings: "Savings", cash: "Cash" };

export default function AccountsPage({ version, onChange, notify, goTo }) {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [form, setForm] = useState({ name: "", type: "checking", deposit: "" });
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(null); // { id, name } while a name is being edited
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    getAccounts()
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  if (error && !accounts) return <ErrorState message={error} onRetry={() => setAttempt(attempt + 1)} />;
  if (!accounts) return <Loading label="Loading your accounts" />;

  const active = accounts.filter((a) => a.status === "active");
  const closed = accounts.filter((a) => a.status === "closed");
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  async function submitCreate(event) {
    event.preventDefault();
    setFormError("");
    let initialDeposit = 0;
    if (form.deposit.trim() !== "") {
      initialDeposit = parseTndToMillimes(form.deposit);
      if (initialDeposit === null) return setFormError("Enter a valid amount, with up to 3 decimals.");
    }
    setCreating(true);
    try {
      const account = await createAccount({ name: form.name, type: form.type, initialDeposit });
      notify("success", "Account \"" + account.name + "\" created.");
      setForm({ name: "", type: "checking", deposit: "" });
      onChange();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function submitRename(event) {
    event.preventDefault();
    setEditError("");
    try {
      await renameAccount(editing.id, editing.name);
      notify("success", "Account renamed.");
      setEditing(null);
      onChange();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleClose(account) {
    try {
      await closeAccount(account._id);
      notify("success", "\"" + account.name + "\" is now closed. Its history is kept.");
      onChange();
    } catch (err) {
      notify("error", err.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">
            {active.length} {active.length === 1 ? "account" : "accounts"} in Tunisian dinar, {formatTnd(total)} in total.
          </p>
        </div>
      </div>

      <div className="columns">
        <div className="grow-wide stack">
          <div className="cards-grid">
            {active.map((account) => {
              const isEditing = editing && editing.id === account._id;
              return (
                <article key={account._id} className="panel account-card" aria-labelledby={"acc-" + account._id}>
                  <div className="account-card__head">
                    {isEditing ? (
                      <form className="account-card__rename" onSubmit={submitRename}>
                        <label className="field">
                          <span className="sr-only">Account name</span>
                          <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-invalid={editError ? "true" : "false"} />
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
                      <h2 className="panel__title account-card__name" id={"acc-" + account._id}>
                        {account.name}
                      </h2>
                    )}
                    <span className="tag">{TYPE_LABELS[account.type]}</span>
                  </div>

                  <BigMoney millimes={account.balance} size={38} />
                  <p className="muted small">{account.lastMovementAt ? "Last movement on " + formatDayYear(account.lastMovementAt) : "No movement yet"}</p>

                  <div className="row account-card__actions">
                    <button type="button" className="btn btn--small" onClick={() => goTo("history")}>
                      View history
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => { setEditing({ id: account._id, name: account.name }); setEditError(""); }}>
                      Rename
                    </button>
                    <button type="button" className="btn btn--small" disabled={account.balance !== 0} onClick={() => handleClose(account)}>
                      Close account
                    </button>
                  </div>
                  <p className="muted small">{account.balance === 0 ? "The balance is 0: this account can be closed." : "An account can be closed once its balance is 0.000."}</p>
                </article>
              );
            })}
          </div>

          <section className="panel" aria-labelledby="closed-title">
            <h2 className="panel__title" id="closed-title" style={{ fontSize: 18 }}>
              Closed accounts
            </h2>
            {closed.length === 0 ? (
              <p className="muted" style={{ marginTop: 10 }}>
                No closed account.
              </p>
            ) : (
              <ul className="closed-list">
                {closed.map((account) => (
                  <li key={account._id} className="closed-list__row">
                    <div>
                      <p style={{ fontWeight: 600 }}>{account.name}</p>
                      <p className="muted small">Closed on {formatDayYear(account.closedAt)}. Its history stays in the ledger.</p>
                    </div>
                    <p className="num neutral">{formatTnd(account.balance)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form className="panel side-form" onSubmit={submitCreate} noValidate aria-labelledby="new-title">
          <div>
            <h2 className="panel__title" id="new-title">
              New account
            </h2>
            <p className="panel__subtitle">All accounts are in Tunisian dinar.</p>
          </div>
          <label className="field">
            Account name
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="For example: holiday fund" />
          </label>
          <label className="field">
            Type
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label className="field">
            Initial deposit, optional
            <span className="input-money">
              <input className="input num" inputMode="decimal" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} placeholder="0.000" />
              <span className="input-money__unit">TND</span>
            </span>
          </label>
          {formError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={creating}>
            {creating ? "Creating…" : "Create the account"}
          </button>
        </form>
      </div>
    </>
  );
}
