// The payment pieces shared by the sign-up form and the Premium page, laid out like the checkout of
// a streaming service: the chosen plan with a "Change" link, the card, a promo code and the terms.
//   Checkout       the whole payment block (controlled: the page keeps its value)
//   PaymentResult  the "Payment successful" / "Payment failed" screen
// The server checks the card and decides the price (with any discount); nothing here is trusted.
import { useEffect, useState } from "react";
import { getPlans, getQuote } from "../services/index.js";
import Icon from "./Icon.jsx";
import { formatDayYear } from "../utils/dates.js";
import { formatTnd } from "../utils/money.js";

const FALLBACK_PRICES = {
  monthly: { amount: 9_900, originalAmount: 9_900, offer: null },
  yearly: { amount: 99_000, originalAmount: 99_000, offer: null },
};
const PER = { monthly: "month", yearly: "year" };
const LABEL = { monthly: "Premium monthly", yearly: "Premium yearly" };

export const EMPTY_CARD = { holder: "", number: "", expiry: "", cvc: "" };
export const EMPTY_CHECKOUT = { interval: "yearly", card: EMPTY_CARD, promo: null }; // promo: { code, percentOff, name }

// "4242424242424242" -> "4242 4242 4242 4242" while typing.
function groupDigits(value) {
  return value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}
function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
}
function brandOf(number) {
  const digits = number.replace(/\D/g, "");
  if (/^9788/.test(digits)) return "edinar";
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  return "";
}

/** What the API expects: { holder, number, expMonth, expYear, cvc }. */
export function cardPayload(card) {
  const [expMonth = "", expYear = ""] = card.expiry.split("/");
  return { holder: card.holder, number: card.number, expMonth, expYear, cvc: card.cvc };
}

/** True when every card box has something in it (the server does the real checks). */
export function cardFilled(card) {
  return Boolean(card.holder.trim() && card.number.trim() && card.expiry.trim() && card.cvc.trim());
}

/** The price shown for this plan: the promo code wins over the automatic offer. Same rounding as the server. */
export function priceFor(prices, value) {
  const p = prices[value.interval];
  if (value.promo) return { ...p, amount: Math.max(0, Math.round((p.originalAmount * (100 - value.promo.percentOff)) / 100)), offer: value.promo };
  return p;
}

function CardLogos({ active }) {
  return (
    <div className="card-logos" aria-label="Accepted cards: Visa, Mastercard, e-DINAR">
      {[
        ["visa", "VISA"],
        ["mastercard", "Mastercard"],
        ["edinar", "e-DINAR"],
      ].map(([id, label]) => (
        <span key={id} className={"card-logo card-logo--" + id + (active && active !== id ? " card-logo--dim" : "")} aria-hidden="true">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * The checkout block. value: { interval, card, promo }; onChange(nextValue).
 * loggedIn: false before sign-up (uses the public price list).
 * prices: the loaded price list is passed up with onPrices, so the page can show the total on its button.
 */
export function Checkout({ value, onChange, loggedIn = true, idPrefix = "card", step = null, onPrices }) {
  const [prices, setPrices] = useState(FALLBACK_PRICES);
  const [changing, setChanging] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlans({ loggedIn })
      .then((res) => {
        if (cancelled) return;
        const next = Object.fromEntries(res.prices.map((p) => [p.interval, p]));
        setPrices(next);
        if (onPrices) onPrices(next);
      })
      .catch(() => {}); // the fallback prices stay; the server decides anyway
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const set = (field, v) => onChange({ ...value, [field]: v });
  const setCard = (field, v) => onChange({ ...value, card: { ...value.card, [field]: v } });
  const shown = priceFor(prices, value);
  const brand = brandOf(value.card.number);

  async function applyPromo(code, interval = value.interval) {
    setPromoError("");
    setChecking(true);
    try {
      const q = await getQuote({ interval, code, loggedIn });
      onChange({ ...value, interval, promo: { code: q.offer.code, percentOff: q.offer.percentOff, name: q.offer.name } });
      setPromoOpen(false);
      setPromoInput("");
    } catch (err) {
      setPromoError(err.message);
      if (interval !== value.interval) onChange({ ...value, interval, promo: null });
    } finally {
      setChecking(false);
    }
  }

  function chooseInterval(interval) {
    setChanging(false);
    if (value.promo) applyPromo(value.promo.code, interval); // the code may only cover one plan
    else onChange({ ...value, interval });
  }

  return (
    <div className="checkout">
      {step && <p className="checkout__step">{step}</p>}
      <h3 className="checkout__title">Set up your credit or debit card</h3>
      <CardLogos active={brand} />

      <div className="card-fields">
        <label className="field" htmlFor={idPrefix + "-number"}>
          Card number
          <span className="card-number">
            <input
              id={idPrefix + "-number"}
              className="input num"
              inputMode="numeric"
              autoComplete="cc-number"
              value={value.card.number}
              onChange={(e) => setCard("number", groupDigits(e.target.value))}
              placeholder="1234 5678 9012 3456"
            />
            <Icon name="lock" size={14} />
          </span>
        </label>
        <div className="card-fields__row">
          <label className="field" htmlFor={idPrefix + "-exp"}>
            Expiration date
            <input id={idPrefix + "-exp"} className="input num" inputMode="numeric" autoComplete="cc-exp" value={value.card.expiry} onChange={(e) => setCard("expiry", formatExpiry(e.target.value))} placeholder="MM/YY" />
          </label>
          <label className="field" htmlFor={idPrefix + "-cvc"}>
            CVV
            <input
              id={idPrefix + "-cvc"}
              className="input num"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={value.card.cvc}
              onChange={(e) => setCard("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="3 digits on the back"
            />
          </label>
        </div>
        <label className="field" htmlFor={idPrefix + "-holder"}>
          Name on card
          <input id={idPrefix + "-holder"} className="input" autoComplete="cc-name" value={value.card.holder} onChange={(e) => setCard("holder", e.target.value)} placeholder="As written on the card" />
        </label>
      </div>

      <div className="plan-summary">
        <div className="plan-summary__main">
          <p className="plan-summary__price">
            {shown.amount !== shown.originalAmount && <s className="muted">{formatTnd(shown.originalAmount)}</s>} <span className="num">{formatTnd(shown.amount)}</span>/{PER[value.interval]}
          </p>
          <p className="plan-summary__name">{LABEL[value.interval]}</p>
          {shown.offer && (
            <p className="plan-summary__offer">
              <Icon name="check" size={12} /> {shown.offer.name}: −{shown.offer.percentOff}%{shown.offer.code ? " with " + shown.offer.code : ""}
              {value.promo && (
                <button type="button" className="link-button small" onClick={() => set("promo", null)}>
                  Remove
                </button>
              )}
            </p>
          )}
        </div>
        <button type="button" className="link-button plan-summary__change" onClick={() => setChanging(!changing)} aria-expanded={changing}>
          Change
        </button>
      </div>
      {changing && (
        <div className="interval-pick" role="group" aria-label="Choose a plan">
          {["monthly", "yearly"].map((id) => {
            const p = priceFor(prices, { ...value, interval: id, promo: value.promo && value.interval === id ? value.promo : null });
            return (
              <button key={id} type="button" className="interval-pick__option" aria-pressed={value.interval === id} onClick={() => chooseInterval(id)}>
                <span className="interval-pick__label">
                  {LABEL[id]}
                  {id === "yearly" && <span className="plan-save">2 months free</span>}
                </span>
                <span className="interval-pick__price num">
                  {formatTnd(p.amount)} / {PER[id]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {promoOpen ? (
        <div className="promo">
          <label className="field" htmlFor={idPrefix + "-promo"}>
            Promo code
            <span className="promo__row">
              <input
                id={idPrefix + "-promo"}
                className="input"
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20));
                  setPromoError("");
                }}
                placeholder="WELCOME20"
              />
              <button type="button" className="btn btn--small" disabled={checking || promoInput.length < 3} onClick={() => applyPromo(promoInput)}>
                {checking ? "Checking…" : "Apply"}
              </button>
            </span>
          </label>
          {promoError && (
            <p className="form-error" role="alert">
              <Icon name="warning" />
              {promoError}
            </p>
          )}
        </div>
      ) : (
        !value.promo && (
          <button type="button" className="link-button promo__open" onClick={() => setPromoOpen(true)}>
            Have a promo code?
          </button>
        )
      )}

      <p className="checkout__terms">
        By clicking the button below, you agree that TuniBudget will charge <strong>{formatTnd(shown.amount)}</strong> for one {PER[value.interval]} of Premium. It does not
        renew by itself, and you can cancel at any time from <em>My plan</em>.
      </p>
      <p className="checkout__secure">
        <Icon name="lock" size={12} /> Secure, encrypted payment. Your full card number is never stored.
      </p>
    </div>
  );
}

/**
 * result: { ok: true, payment } or { ok: false, message, card }.
 * The buttons are given by the page: onPrimary / onSecondary.
 */
export function PaymentResult({ result, primaryLabel, onPrimary, secondaryLabel, onSecondary }) {
  const p = result.payment;
  return (
    <section className={"panel payment-result" + (result.ok ? " payment-result--ok" : " payment-result--failed")} role="status" aria-live="polite">
      <span className="payment-result__icon" aria-hidden="true">
        <Icon name={result.ok ? "check" : "cross"} size={34} />
      </span>
      <h1 className="payment-result__title">{result.ok ? "Payment successful" : "Payment failed"}</h1>
      <p className="payment-result__text">{result.ok ? "Welcome to TuniBudget Premium! Every Premium feature is unlocked." : result.message}</p>

      {result.ok ? (
        <dl className="payment-result__receipt">
          <div>
            <dt>Plan</dt>
            <dd>{LABEL[p.interval] || "Premium"}</dd>
          </div>
          {p.offer && (
            <div>
              <dt>Offer</dt>
              <dd>
                {p.offer.name} (−{p.offer.percentOff}%)
              </dd>
            </div>
          )}
          <div>
            <dt>Amount paid</dt>
            <dd className="num">{formatTnd(p.amount)}</dd>
          </div>
          {p.card && (
            <div>
              <dt>Card</dt>
              <dd>
                {p.card.brand} •••• <span className="num">{p.card.last4}</span>
              </dd>
            </div>
          )}
          <div>
            <dt>Premium until</dt>
            <dd>{formatDayYear(p.periodEnd)}</dd>
          </div>
          <div>
            <dt>Receipt</dt>
            <dd className="num small">{p._id}</dd>
          </div>
        </dl>
      ) : (
        result.card && (
          <p className="muted small">
            {result.card.brand} •••• <span className="num">{result.card.last4}</span> · no money was taken
          </p>
        )
      )}

      <div className="payment-result__actions">
        <button type="button" className="btn btn--primary" onClick={onPrimary}>
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button type="button" className="btn" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
}
