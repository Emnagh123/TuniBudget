import { useEffect, useState } from "react";
import { getAccounts, planTransferSteps, transfer } from "../services/index.js";
import { formatMillimes, formatTnd, parseTndToMillimes } from "../utils/money.js";
import Icon from "../components/Icon.jsx";
import TransferSteps from "../components/TransferSteps.jsx";
import { ErrorState, Loading } from "../components/StateMessage.jsx";

export default function TransferPage({ version, onChange, notify }) {
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);

  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  // result: { ok: true, ...transferResult } | { ok: false, message, steps }
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    getAccounts()
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  if (loadError && !accounts) return <ErrorState message={loadError} onRetry={() => setAttempt(attempt + 1)} />;
  if (!accounts) return <Loading label="Loading your accounts" />;

  const active = accounts.filter((a) => a.status === "active");
  if (active.length < 2) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Transfer</h1>
          </div>
        </div>
        <div className="panel panel--fit">
          <p className="state__title">You need two open accounts to make a transfer.</p>
          <p className="muted" style={{ marginTop: 8 }}>
            Open another account in the Accounts page first.
          </p>
        </div>
      </>
    );
  }

  // The selected accounts always exist and are always different.
  const from = active.find((a) => a._id === fromId) || active[0];
  const to = active.find((a) => a._id === toId && a._id !== from._id) || active.find((a) => a._id !== from._id);

  const amount = parseTndToMillimes(amountText);
  const hasAmount = amount !== null && amount > 0;
  const preview = planTransferSteps({ fromName: from.name, toName: to.name, amount: hasAmount ? amount : 0, simulateFailure }).map((step) =>
    !hasAmount && (step.key === "debit" || (step.key === "credit" && !simulateFailure)) ? { ...step, detail: "Waiting for an amount." } : step
  );

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (amount === null || amount <= 0) {
      return setFormError(amountText.trim() === "" ? "Enter the amount to send." : "Enter a valid amount greater than 0, with up to 3 decimals.");
    }
    setSending(true);
    setResult(null);
    try {
      const done = await transfer({ fromAccountId: from._id, toAccountId: to._id, amount, description, simulateFailure });
      setResult({ ok: true, ...done });
      setFormError("");
      setAmountText("");
      setDescription("");
      notify("success", formatTnd(amount) + " sent from " + done.from.name + " to " + done.to.name + ".");
      onChange();
    } catch (err) {
      // Errors raised inside the transaction carry the journal of what happened (and was undone).
      if (err.steps) {
        setResult({ ok: false, message: err.message, steps: err.steps });
        onChange();
      } else {
        setFormError(err.message);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transfer</h1>
        </div>
      </div>

      <div className="columns">
        <form className="panel grow-wide stack" onSubmit={submit} noValidate aria-labelledby="transfer-title">
          <h2 className="panel__title" id="transfer-title">
            New transfer
          </h2>

          <fieldset className="choice-group">
            <legend>From</legend>
            <div className="choice-list">
              {active.map((account) => (
                <button key={account._id} type="button" className="choice" aria-pressed={account._id === from._id} onClick={() => setFromId(account._id)}>
                  <span className="choice__name">{account.name}</span>
                  <span className="choice__balance num">{formatMillimes(account.balance)} TND</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>To</legend>
            <div className="choice-list">
              {active.map((account) => (
                <button
                  key={account._id}
                  type="button"
                  className="choice"
                  aria-pressed={account._id === to._id}
                  disabled={account._id === from._id}
                  onClick={() => setToId(account._id)}
                >
                  <span className="choice__name">{account.name}</span>
                  <span className="choice__balance num">{account._id === from._id ? "Selected as the source" : formatMillimes(account.balance) + " TND"}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            Amount
            <span className="input-money">
              <input className="input num" inputMode="decimal" value={amountText} onChange={(e) => { setAmountText(e.target.value); setFormError(""); }} placeholder="0.000" aria-invalid={formError ? "true" : "false"} />
              <span className="input-money__unit">TND</span>
            </span>
          </label>

          <label className="field">
            Description, optional
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={"Transfer to " + to.name} />
          </label>

          <label className="check">
            <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
            <span>
              Simulate a crash before the credit
            </span>
          </label>

          {formError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={sending}>
            {sending ? "Transfer in progress…" : "Send the transfer"}
          </button>
        </form>

        <aside className="panel side-form" aria-labelledby="journal-title">
          {result === null && (
            <>
              <div>
                <h2 className="panel__title" id="journal-title">
                  What will happen
                </h2>
              </div>
              <TransferSteps steps={preview} />
            </>
          )}

          {result !== null && result.ok && (
            <>
              <div>
                <h2 className="panel__title" id="journal-title">
                  Transfer completed
                </h2>
              </div>
              <p className="notice notice--ok" role="status">
                <Icon name="check" />
                <span>
                  {formatTnd(result.amount)} moved from {result.from.name} to {result.to.name}.
                </span>
              </p>
              <TransferSteps steps={result.steps} />
              <dl className="result-balances">
                <div>
                  <dt>{result.from.name}</dt>
                  <dd className="num">{formatTnd(result.from.balance)}</dd>
                </div>
                <div>
                  <dt>{result.to.name}</dt>
                  <dd className="num">{formatTnd(result.to.balance)}</dd>
                </div>
              </dl>
            </>
          )}

          {result !== null && !result.ok && (
            <>
              <div>
                <h2 className="panel__title" id="journal-title">
                  Transfer rolled back
                </h2>
              </div>
              <p className="notice notice--error" role="alert">
                <Icon name="warning" />
                <span>{result.message}</span>
              </p>
              {result.steps.length > 0 && <TransferSteps steps={result.steps} />}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
