// Plans, offers and the simulated checkout. The server decides the price (with any discount)
// and checks the card; this file only sends the chosen plan, the card fields and the promo code.
import { request } from "./api.js";

/** Prices with the automatic offer already applied. Before sign-up (no session) use loggedIn: false. */
export function getPlans({ loggedIn = true } = {}) {
  return request("GET", loggedIn ? "/billing/plans" : "/billing/public/plans");
}

/** Checks a promo code: { amount, originalAmount, offer } or an INVALID_PROMO error. */
export function getQuote({ interval, code = "", loggedIn = true }) {
  return request("GET", loggedIn ? "/billing/quote" : "/billing/public/quote", { query: { interval, code } });
}

/** { user, payments } — the current plan and the user's own payments, newest first. */
export function getMyBilling() {
  return request("GET", "/billing/me");
}

/** interval: "monthly" | "yearly". card: { number, expMonth, expYear, cvc, holder }. */
export function checkout({ interval, card, promoCode = "" }) {
  return request("POST", "/billing/checkout", { body: { interval, card, ...(promoCode ? { promoCode } : {}) }, idempotent: true });
}

export function cancelPremium() {
  return request("POST", "/billing/cancel");
}
