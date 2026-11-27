import { useEffect, useState } from "react";
import { cancelPremium, checkout, getMyBilling } from "../services/index.js";
import { formatDayYear } from "../utils/dates.js";
import { formatMillimes, formatTnd } from "../utils/money.js";
import Icon from "../components/Icon.jsx";
import { Checkout, EMPTY_CHECKOUT, PaymentResult, cardPayload, priceFor } from "../components/CardForm.jsx";
import { ErrorState, Loading } from "../components/StateMessage.jsx";

const FEATURES = [
  { label: "Open accounts", free: "Up to 3", premium: "Unlimited" },
  { label: "History", free: "Last 3 months", premium: "Full history" },
  { label: "Export to CSV", free: false, premium: true },
  { label: "Budgets", free: "Current month", premium: "Any month" },
  { label: "Copy last month's budgets", free: false, premium: true },
  { label: "Balance chart", free: "30 / 90 days", premium: "30 / 90 / 365 days" },
  { label: "Premium badge", free: false, premium: true },
];

function Cell({ value }) {
  if (value === true) return <Icon name="check" />;
  if (value === false) return <span className="muted">—</span>;
  return value;
}

// Free users: the plans and the checkout. Premium users and admins: their plan and payments.
// initialResult: the payment made during sign-up, shown first as the result screen.
export default function PremiumPage({ user, version, onChange, onUserChange, goTo, initialResult = null }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [pay, setPay] = useState(EMPTY_CHECKOUT); // { interval, card, promo }
  const [prices, setPrices] = useState(null);
  const [formError, setFormError] = useState("");
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(initialResult); // { ok, payment } or { ok: false, message, card }

  // Show the result screen from its top (the pay button is far down the page).
  useEffect(() => {
    if (result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    getMyBilling()
      .then((billing) => {
        if (cancelled) return;
        setPayments(billing.payments);
        onUserChange(billing.user);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  if (result) {
    return (
      <div className="payment-result-wrap">
        {result.ok ? (
          <PaymentResult result={result} primaryLabel="Start using Premium" onPrimary={() => goTo("dashboard")} secondaryLabel="See my plan" onSecondary={() => setResult(null)} />
        ) : (
          <PaymentResult
            result={result}
            primaryLabel="Try again"
            onPrimary={() => setResult(null)}
            secondaryLabel="Use another card"
            onSecondary={() => {
              setPay({ ...pay, card: EMPTY_CHECKOUT.card });
              setResult(null);
            }}
          />
        )}
      </div>
    );
  }

  if (error && !payments) return <ErrorState message={error} onRetry={() => setAttempt(attempt + 1)} />;
  if (!payments) return <Loading label="Loading your plan" />;

  const isPremium = user.plan === "premium";
  const isAdmin = user.role === "admin";
  const price = prices ? priceFor(prices, pay) : null;

  async function submitPayment(event) {
    event.preventDefault();
    setFormError("");
    setPaying(true);
    try {
      const paid = await checkout({ interval: pay.interval, card: cardPayload(pay.card), promoCode: pay.promo ? pay.promo.code : "" });
      setPay(EMPTY_CHECKOUT);
      onUserChange(paid.user);
      setResult({ ok: true, payment: paid.payment });
      onChange();
    } catch (err) {
      if (err.code === "INVALID_CARD" || err.code === "VALIDATION_ERROR" || err.code === "INVALID_PROMO") {
        setFormError(err.message); // a typo: fix it in the form
      } else {
        setPay({ ...pay, card: { ...pay.card, cvc: "" } });
        setResult({ ok: false, message: err.message, card: err.card || null });
        if (err.code === "PAYMENT_DECLINED") onChange();
      }
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    try {
      const res = await cancelPremium();
      onUserChange(res.user);
      onChange();
    } catch (err) {
      setFormError(err.message);
    }
  }

  const payButton = (
    <button type="submit" className="btn btn--primary btn--block" disabled={paying}>
      {paying ? (
        <span className="paying">
          Processing payment<span className="paying__dots" aria-hidden="true" />
        </span>
      ) : (
        (isPremium ? "Extend Premium" : "Start Premium") + (price ? " · " + formatTnd(price.amount) : "")
      )}
    </button>
  );

  const errorLine = formError && (
    <p className="form-error" role="alert">
      <Icon name="warning" />
      {formError}
    </p>
  );

  const paymentList = (
    <section className="panel" aria-labelledby="payments-title">
      <h2 className="panel__title" id="payments-title">
        Payment history
      </h2>
      {payments.length === 0 ? (
        <p className="muted" style={{ marginTop: 10 }}>
          No payment yet.
        </p>
      ) : (
        <ul className="closed-list">
          {payments.map((p) => (
            <li key={p._id} className="closed-list__row">
              <div>
                <p style={{ fontWeight: 600 }}>
                  Premium {p.interval} · {p.card.brand} •••• {p.card.last4}
                </p>
                <p className="muted small">
                  {formatDayYear(p.createdAt)}
                  {p.status === "paid" && p.periodEnd ? " · until " + formatDayYear(p.periodEnd) : ""}
                </p>
              </div>
              <div className="row">
                <span className={"badge " + (p.status === "paid" ? "badge--ok" : "badge--exceeded")}>{p.status === "paid" ? "Paid" : "Declined"}</span>
                <p className="num neutral">{formatTnd(p.amount)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // ----- Premium users and admins: "My plan" -----
  if (isPremium) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">My plan</h1>
          </div>
        </div>
        <div className="columns">
          <div className="grow-wide stack">
            <article className="panel plan-card plan-card--premium" aria-labelledby="my-plan">
              <div className="plan-card__head">
                <h2 className="panel__title" id="my-plan">
                  Premium
                </h2>
                <span className="premium-badge">{isAdmin ? "Admin" : "Active"}</span>
              </div>
              <p className="plan-card__price">{isAdmin ? "Included with your admin account" : "Active until " + formatDayYear(user.premiumUntil)}</p>
              <ul className="plan-card__list">
                {FEATURES.map((f) => (
                  <li key={f.label}>
                    <Icon name="check" />
                    {f.premium === true ? f.label : f.label + ": " + f.premium}
                  </li>
                ))}
              </ul>
            </article>
            {!isAdmin && paymentList}
          </div>
          {!isAdmin && (
            <form className="panel side-form" onSubmit={submitPayment} noValidate aria-labelledby="extend-title">
              <h2 className="panel__title" id="extend-title">
                Extend Premium
              </h2>
              <Checkout value={pay} onChange={setPay} onPrices={setPrices} idPrefix="extend" />
              {errorLine}
              {payButton}
              <button type="button" className="link-button muted small" onClick={handleCancel}>
                Cancel Premium
              </button>
            </form>
          )}
        </div>
      </>
    );
  }

  // ----- Free users: plans, comparison and checkout -----
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Go Premium</h1>
        </div>
      </div>

      <div className="columns">
        <div className="grow-wide stack">
          <div className="cards-grid">
            <article className="panel plan-card plan-card--current" aria-labelledby="plan-free">
              <div className="plan-card__head">
                <h2 className="panel__title" id="plan-free">
                  Free
                </h2>
                <span className="tag">Your plan</span>
              </div>
              <p className="plan-card__price">
                <span className="plan-card__amount">0</span> TND
              </p>
              <ul className="plan-card__list">
                {FEATURES.filter((f) => f.free).map((f) => (
                  <li key={f.label}>
                    <Icon name="check" />
                    {f.label}: <Cell value={f.free} />
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel plan-card plan-card--premium" aria-labelledby="plan-premium">
              <div className="plan-card__head">
                <h2 className="panel__title" id="plan-premium">
                  Premium
                </h2>
                <span className="premium-badge">Best value</span>
              </div>
              <p className="plan-card__price">
                <span className="plan-card__amount">{formatMillimes(price ? price.amount : pay.interval === "yearly" ? 99000 : 9900)}</span> TND / {pay.interval === "yearly" ? "year" : "month"}
              </p>
              <ul className="plan-card__list">
                {FEATURES.map((f) => (
                  <li key={f.label}>
                    <Icon name="check" />
                    {f.premium === true ? f.label : f.label + ": " + f.premium}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <section className="panel panel--fit" aria-labelledby="compare-title">
            <h2 className="panel__title" id="compare-title">
              Compare
            </h2>
            <div className="table-wrap">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col">Free</th>
                    <th scope="col">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((f) => (
                    <tr key={f.label}>
                      <th scope="row">{f.label}</th>
                      <td>
                        <Cell value={f.free} />
                      </td>
                      <td>
                        <Cell value={f.premium} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {payments.length > 0 && paymentList}
        </div>

        <form className="panel side-form" onSubmit={submitPayment} noValidate aria-label="Payment">
          <Checkout value={pay} onChange={setPay} onPrices={setPrices} idPrefix="pay" />
          {errorLine}
          {payButton}
        </form>
      </div>
    </>
  );
}
