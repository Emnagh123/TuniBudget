// Checks a card typed into the SIMULATED checkout. No real payment network is contacted and no
// money moves. The full card number and the CVC are only checked here, in memory: they are never
// stored, logged or sent back. What is kept is the brand and the last 4 digits, like a receipt.
//
// Test cards (the same numbers payment companies use for testing):
//   4242 4242 4242 4242   payment succeeds
//   4000 0000 0000 0002   declined by the bank
//   4000 0000 0000 9995   declined: insufficient funds
//   9788 0000 0000 0009   e-DINAR (Tunisian card; in this simulation e-DINAR numbers start with 9788)
// Any other valid card number succeeds too, so the demo also works with a made-up Visa or Mastercard.
import { ApiError } from "./errors.js";

const DECLINED = {
  "4000000000000002": "Your card was declined by the bank. Try another card.",
  "4000000000009995": "Your card has insufficient funds. Try another card.",
};

/** Luhn checksum: catches typos in a card number (every real card number passes it). */
export function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function brandOf(digits) {
  if (/^9788/.test(digits)) return "e-DINAR";
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  return "Card";
}

const invalid = (message) => new ApiError("INVALID_CARD", message);

/**
 * Validates the card fields and returns only what may be kept: { brand, last4, holder }.
 * Throws INVALID_CARD for a typo, PAYMENT_DECLINED for a test card that is refused.
 */
export function checkCard(card, now = new Date()) {
  if (!card || typeof card !== "object" || Array.isArray(card)) throw invalid("Enter your card details.");
  const extra = Object.keys(card).filter((k) => !["number", "expMonth", "expYear", "cvc", "holder"].includes(k));
  if (extra.length) throw invalid("Unexpected card field.");

  const holder = typeof card.holder === "string" ? card.holder.trim().replace(/\s+/g, " ") : "";
  if (holder.length < 2 || holder.length > 60 || /[<>\u0000-\u001F]/.test(holder)) throw invalid("Enter the name on the card.");

  const digits = typeof card.number === "string" ? card.number.replace(/[\s-]/g, "") : "";
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) throw invalid("This card number is not valid. Check it and try again.");

  const month = Number(card.expMonth);
  let year = Number(card.expYear);
  if (year < 100) year += 2000;
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) throw invalid("Enter the expiry date as MM/YY.");
  const lastDayOfExpiry = new Date(year, month, 0, 23, 59, 59);
  if (lastDayOfExpiry < now) throw invalid("This card has expired.");
  if (year > now.getFullYear() + 20) throw invalid("Enter the expiry date as MM/YY.");

  const brand = brandOf(digits);
  const cvcLength = brand === "American Express" ? 4 : 3;
  if (typeof card.cvc !== "string" || !new RegExp(`^\\d{${cvcLength}}$`).test(card.cvc)) {
    throw invalid(`Enter the ${cvcLength}-digit security code (CVC).`);
  }

  const kept = { brand, last4: digits.slice(-4), holder };
  if (DECLINED[digits]) throw new ApiError("PAYMENT_DECLINED", DECLINED[digits], { card: { brand, last4: kept.last4 } });
  return kept;
}
