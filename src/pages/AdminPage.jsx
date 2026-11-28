import { useEffect, useState } from "react";
import { createOffer, getAdminOffers, getAdminPayments, getAdminUsers, getAuditLogs, setOfferActive, getSecuritySummary, revokeUserSessions, setUserDisabled } from "../services/index.js";
import { formatDayYear } from "../utils/dates.js";
import { formatTnd } from "../utils/money.js";
import { PremiumBadge } from "../components/PremiumHint.jsx";
import DatePicker from "../components/DatePicker.jsx";

const EMPTY_OFFER = { name: "", code: "", percentOff: "20", monthly: true, yearly: true, endsAt: "", maxUses: "", targetEmail: "" };

function offerStatus(o) {
  if (!o.active) return { label: "Paused", badge: "badge--near" };
  if (o.endsAt && new Date(o.endsAt) < new Date()) return { label: "Ended", badge: "badge--exceeded" };
  if (o.maxUses !== null && o.uses >= o.maxUses) return { label: "Used up", badge: "badge--exceeded" };
  return { label: "Live", badge: "badge--ok" };
}
import Icon from "../components/Icon.jsx";
import { EmptyState, ErrorState, Loading } from "../components/StateMessage.jsx";

const LEVELS = [
  { id: "", label: "All" },
  { id: "warn", label: "Blocked" },
  { id: "alert", label: "Alerts" },
];

const LEVEL_BADGES = { info: "badge--ok", warn: "badge--near", alert: "badge--exceeded" };

function when(date) {
  if (!date) return "Never";
  const d = new Date(date);
  return formatDayYear(d) + ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function eventLabel(event) {
  const text = event.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Only shown to admins. The server checks the role again on every call. */
export default function AdminPage({ user, version, onChange, notify }) {
  const [data, setData] = useState(null); // { summary, users, payments, offers }
  const [payer, setPayer] = useState(""); // userId whose payments are shown ("" = everyone)
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [offerError, setOfferError] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState("");
  const [logs, setLogs] = useState(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([getSecuritySummary(), getAdminUsers(), getAdminPayments(), getAdminOffers()])
      .then(([summary, users, payments, offers]) => {
        if (!cancelled) setData({ summary, users, payments, offers });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  useEffect(() => {
    let cancelled = false;
    getAuditLogs({ level })
      .then((result) => {
        if (!cancelled) setLogs(result.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [level, version, attempt]);

  if (error && !data) return <ErrorState message={error} onRetry={() => setAttempt(attempt + 1)} />;
  if (!data) return <Loading label="Loading the admin data" />;

  const { summary, users, payments, offers } = data;
  const shownPayments = payer ? payments.items.filter((p) => p.userId === payer) : payments.items;
  const payerName = payer ? (users.find((u) => u._id === payer) || {}).fullName : "";

  function showPaymentsOf(userId) {
    setPayer(userId);
    window.requestAnimationFrame(() => {
      const el = document.getElementById("admin-payments-title");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitOffer(event) {
    event.preventDefault();
    setOfferError("");
    const f = offerForm;
    const intervals = [f.monthly && "monthly", f.yearly && "yearly"].filter(Boolean);
    const percentOff = Number(f.percentOff);
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) return setOfferError("The discount must be a whole number from 1 to 100.");
    if (intervals.length === 0) return setOfferError("Choose monthly, yearly or both.");
    const maxUses = f.maxUses.trim() === "" ? null : Number(f.maxUses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return setOfferError("The number of uses must be a whole number from 1.");
    setSavingOffer(true);
    try {
      const offer = await createOffer({
        name: f.name,
        code: f.code || null,
        percentOff,
        intervals,
        endsAt: f.endsAt,
        maxUses,
        targetEmail: f.targetEmail.trim() || null,
      });
      notify("success", "Offer \"" + offer.name + "\" is live" + (offer.code ? " with the code " + offer.code : "") + ".");
      setOfferForm(EMPTY_OFFER);
      onChange();
    } catch (err) {
      setOfferError(err.message);
    } finally {
      setSavingOffer(false);
    }
  }
  const premiumCount = users.filter((u) => u.plan === "premium" && u.role !== "admin").length;
  const blocked = summary.events.filter((e) => !/succeeded|registered|access|committed|requested|completed|payment|premium|offer/.test(e.event));
  const blockedTotal = blocked.reduce((sum, e) => sum + e.count, 0);

  async function run(target, action, successMessage) {
    setBusyId(target._id);
    try {
      await action();
      notify("success", successMessage);
      onChange();
    } catch (err) {
      notify("error", err.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
        </div>
      </div>

      <div className="columns columns--stretch">
        <section className="panel summary" aria-labelledby="admin-summary-title">
          <h2 className="panel__title" id="admin-summary-title">
            Last 24 hours
          </h2>
          <dl className="summary__list">
            <div className="summary__row">
              <dt>Users</dt>
              <dd className="summary__value num">{users.length}</dd>
            </div>
            <div className="summary__row">
              <dt>Premium users</dt>
              <dd className="summary__value num">{premiumCount}</dd>
            </div>
            <div className="summary__row">
              <dt>Paid in total</dt>
              <dd className="summary__value num">{formatTnd(payments.paidTotal)}</dd>
            </div>
            <div className="summary__row">
              <dt>Active sessions</dt>
              <dd className="summary__value num">{summary.activeSessions}</dd>
            </div>
            <div className="summary__row">
              <dt>Blocked requests</dt>
              <dd className="summary__value num">{blockedTotal}</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>Alerts</dt>
              <dd className="summary__total num">{summary.alerts.length}</dd>
            </div>
          </dl>
        </section>

        <section className="panel grow-wide" aria-labelledby="admin-events-title">
          <h2 className="panel__title" id="admin-events-title">
            Events by type
          </h2>
          {summary.events.length === 0 ? (
            <EmptyState title="Nothing happened in the last 24 hours" />
          ) : (
            <ul className="closed-list">
              {summary.events.map((e) => (
                <li key={e.event} className="closed-list__row">
                  <span>{eventLabel(e.event)}</span>
                  <span className="num">{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {summary.alerts.length > 0 && (
        <p className="notice notice--error columns--gap-top" role="alert">
          <Icon name="warning" />
          Latest alert: {summary.alerts[0].details.blockedEventsInLast15Minutes} blocked requests from {summary.alerts[0].ip} ({when(summary.alerts[0].at)}).
        </p>
      )}

      <section className="panel columns--gap-top" aria-labelledby="admin-users-title">
        <h2 className="panel__title" id="admin-users-title">
          Users
        </h2>
        <div className="table-wrap columns--gap-top">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Payments</th>
                <th>Last log-in</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u._id === user._id;
                return (
                  <tr key={u._id}>
                    <td>
                      {u.fullName}
                      {u.disabled && <span className="badge badge--exceeded admin__inline-badge">Disabled</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="tag">{u.role === "admin" ? "Admin" : "User"}</span>
                    </td>
                    <td className="nowrap">
                      {u.role === "admin" ? (
                        <span className="muted small">Included</span>
                      ) : u.plan === "premium" ? (
                        <button type="button" className="premium-badge-button" onClick={() => showPaymentsOf(u._id)} title={"See the payments of " + u.fullName}>
                          <PremiumBadge />
                          <span className="muted small"> until {formatDayYear(u.premiumUntil)}</span>
                        </button>
                      ) : (
                        <span className="tag">Free</span>
                      )}
                    </td>
                    <td className="nowrap">
                      {u.billing.paidCount + u.billing.declinedCount === 0 ? (
                        <span className="muted small">Never paid</span>
                      ) : (
                        <button type="button" className="link-button" onClick={() => showPaymentsOf(u._id)}>
                          {u.billing.paidCount} paid · {formatTnd(u.billing.paidTotal)}
                          {u.billing.declinedCount > 0 ? " · " + u.billing.declinedCount + " declined" : ""}
                        </button>
                      )}
                    </td>
                    <td className="nowrap muted">{when(u.lastLoginAt)}</td>
                    <td className="right">
                      {isMe ? (
                        <span className="muted small">You</span>
                      ) : (
                        <div className="row admin__actions">
                          <button
                            type="button"
                            className="btn btn--small"
                            disabled={busyId === u._id}
                            onClick={() => run(u, () => revokeUserSessions(u._id), u.fullName + " was logged out of every device.")}
                          >
                            Log out everywhere
                          </button>
                          <button
                            type="button"
                            className="btn btn--small"
                            disabled={busyId === u._id}
                            onClick={() => run(u, () => setUserDisabled(u._id, !u.disabled), u.fullName + (u.disabled ? " can log in again." : " can no longer log in."))}
                          >
                            {u.disabled ? "Enable" : "Disable"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="columns columns--gap-top">
        <section className="panel grow-wide" aria-labelledby="admin-offers-title">
          <h2 className="panel__title" id="admin-offers-title">
            Discounts and offers
          </h2>
          {offers.length === 0 ? (
            <EmptyState title="No offer yet" />
          ) : (
            <div className="table-wrap columns--gap-top">
              <table>
                <thead>
                  <tr>
                    <th>Offer</th>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>For</th>
                    <th>Used</th>
                    <th>Status</th>
                    <th className="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => {
                    const status = offerStatus(o);
                    return (
                      <tr key={o._id}>
                        <td>
                          {o.name}
                          <span className="muted small">{o.endsAt ? " · until " + formatDayYear(o.endsAt) : " · no end date"}</span>
                        </td>
                        <td className="num">{o.code || <span className="muted small">Automatic</span>}</td>
                        <td className="num">
                          −{o.percentOff}% <span className="muted small">{o.intervals.length === 2 ? "both plans" : o.intervals[0]}</span>
                        </td>
                        <td>{o.target || <span className="muted small">Everyone</span>}</td>
                        <td className="num">
                          {o.uses}
                          {o.maxUses !== null ? " / " + o.maxUses : ""}
                        </td>
                        <td>
                          <span className={"badge " + status.badge}>{status.label}</span>
                        </td>
                        <td className="right">
                          <button
                            type="button"
                            className="btn btn--small"
                            disabled={busyId === o._id}
                            onClick={() => run(o, () => setOfferActive(o._id, !o.active), "\"" + o.name + "\" is now " + (o.active ? "paused." : "live again."))}
                          >
                            {o.active ? "Pause" : "Restart"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="panel side-form" onSubmit={submitOffer} noValidate aria-labelledby="new-offer-title">
          <h2 className="panel__title" id="new-offer-title">
            New offer
          </h2>
          <label className="field">
            Name
            <input className="input" value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="For example: Ramadan offer" />
          </label>
          <div className="card-fields__row">
            <label className="field">
              Discount
              <span className="input-money">
                <input className="input num" inputMode="numeric" value={offerForm.percentOff} onChange={(e) => setOfferForm({ ...offerForm, percentOff: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                <span className="input-money__unit">%</span>
              </span>
            </label>
            <label className="field">
              Promo code
              <input
                className="input"
                value={offerForm.code}
                onChange={(e) => setOfferForm({ ...offerForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })}
                placeholder="Empty = automatic"
              />
            </label>
          </div>
          <div className="field">
            <span>Plans</span>
            <div className="segmented" role="group" aria-label="Plans">
              <button type="button" className="segmented__option" aria-pressed={offerForm.monthly} onClick={() => setOfferForm({ ...offerForm, monthly: !offerForm.monthly })}>
                Monthly
              </button>
              <button type="button" className="segmented__option" aria-pressed={offerForm.yearly} onClick={() => setOfferForm({ ...offerForm, yearly: !offerForm.yearly })}>
                Yearly
              </button>
            </div>
          </div>
          <div className="field">
            <span id="offer-end-label">Ends on, optional</span>
            <DatePicker id="offer-end" labelledBy="offer-end-label" value={offerForm.endsAt} onChange={(value) => setOfferForm({ ...offerForm, endsAt: value })} />
          </div>
          <div className="card-fields__row">
            <label className="field">
              Max uses
              <input className="input num" inputMode="numeric" value={offerForm.maxUses} onChange={(e) => setOfferForm({ ...offerForm, maxUses: e.target.value.replace(/\D/g, "").slice(0, 7) })} placeholder="No limit" />
            </label>
            <label className="field">
              Only for (email)
              <input className="input" type="email" value={offerForm.targetEmail} onChange={(e) => setOfferForm({ ...offerForm, targetEmail: e.target.value })} placeholder="Everyone" />
            </label>
          </div>
          {offerError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {offerError}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={savingOffer}>
            {savingOffer ? "Creating…" : "Create the offer"}
          </button>
        </form>
      </div>

      <section className="panel columns--gap-top" aria-labelledby="admin-payments-title">
        <div className="panel__head">
          <h2 className="panel__title" id="admin-payments-title">
            {payer ? "Payments of " + payerName : "Payments"}
          </h2>
          <label className="field admin__payer">
            <span className="sr-only">Show the payments of</span>
            <select className="input" value={payer} onChange={(e) => setPayer(e.target.value)}>
              <option value="">Every user</option>
              {users
                .filter((u) => u.billing.paidCount + u.billing.declinedCount > 0)
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {shownPayments.length === 0 ? (
          <EmptyState title="No payment yet" />
        ) : (
          <div className="table-wrap columns--gap-top">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Card</th>
                  <th>Offer</th>
                  <th>Status</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shownPayments.map((p) => (
                  <tr key={p._id}>
                    <td className="nowrap muted">{when(p.createdAt)}</td>
                    <td>
                      {p.user ? p.user.fullName : "Deleted user"}
                      {p.user && <span className="muted small"> · {p.user.email}</span>}
                    </td>
                    <td>{p.interval ? "Premium " + p.interval : "Premium"}</td>
                    <td className="nowrap">
                      {p.card ? (
                        <>
                          {p.card.brand} •••• <span className="num">{p.card.last4}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="nowrap">{p.offer ? p.offer.name + " −" + p.offer.percentOff + "%" : <span className="muted">—</span>}</td>
                    <td>
                      <span className={"badge " + (p.status === "paid" ? "badge--ok" : "badge--exceeded")}>{p.status === "paid" ? "Paid" : "Declined"}</span>
                    </td>
                    <td className="right num nowrap">
                      {p.originalAmount !== p.amount && <s className="muted small">{formatTnd(p.originalAmount)} </s>}
                      {formatTnd(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel columns--gap-top" aria-labelledby="admin-log-title">
        <div className="panel__head">
          <h2 className="panel__title" id="admin-log-title">
            Security log
          </h2>
          <div className="segmented" role="group" aria-label="Show">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className="segmented__option" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        {!logs ? (
          <Loading label="Loading the log" />
        ) : logs.length === 0 ? (
          <EmptyState title="No event to show" />
        ) : (
          <div className="table-wrap columns--gap-top">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Level</th>
                  <th>IP</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="nowrap muted">{when(log.at)}</td>
                    <td>{eventLabel(log.event)}</td>
                    <td>
                      <span className={"badge " + (LEVEL_BADGES[log.level] || "")}>{log.level}</span>
                    </td>
                    <td className="num">{log.ip || "—"}</td>
                    <td className="muted small">{log.path || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
