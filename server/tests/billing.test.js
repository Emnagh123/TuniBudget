// Unit tests of the plans, the card checks of the simulated checkout and the CSV export: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCard, luhn } from "../card.js";
import { extendPremium, historyStart, perksOf, planOf } from "../plans.js";
import { csvCell } from "../routes/transactions.js";
import { discounted } from "../offers.js";

test("offers: the discount is computed in whole millimes", () => {
  assert.equal(discounted(99_000, 20), 79_200);
  assert.equal(discounted(9_900, 33), 6_633);
  assert.equal(discounted(9_900, 100), 0);
});

const now = new Date(2026, 10, 27); // 27 Nov 2026
const card = (extra = {}) => ({ number: "4242 4242 4242 4242", expMonth: "12", expYear: "30", cvc: "123", holder: "Amine Ben Ali", ...extra });

test("plan: free by default, premium while paid, admins always premium", () => {
  assert.equal(planOf({ role: "user" }, now), "free");
  assert.equal(planOf({ role: "user", premiumUntil: new Date(2026, 11, 1) }, now), "premium");
  assert.equal(planOf({ role: "user", premiumUntil: new Date(2026, 10, 1) }, now), "free"); // expired
  assert.equal(planOf({ role: "admin" }, now), "premium");
  assert.equal(perksOf({ role: "user" }, now).maxOpenAccounts, 3);
  assert.deepEqual(perksOf({ role: "admin" }, now).chartDays, [30, 90, 365]);
});

test("plan: free history starts on the 1st of the month two months back", () => {
  assert.deepEqual(historyStart(perksOf({ role: "user" }, now), now), new Date(2026, 8, 1));
  assert.equal(historyStart(perksOf({ role: "admin" }, now), now), null);
});

test("plan: paying early adds to the time that is left", () => {
  assert.deepEqual(extendPremium(null, 1, now), new Date(2026, 11, 27));
  assert.deepEqual(extendPremium(new Date(2026, 11, 10), 12, now), new Date(2027, 11, 10));
});

test("card: Luhn catches a typo", () => {
  assert.equal(luhn("4242424242424242"), true);
  assert.equal(luhn("4242424242424241"), false);
});

test("card: a valid card keeps only brand, last 4 and holder", () => {
  const kept = checkCard(card(), now);
  assert.deepEqual(kept, { brand: "Visa", last4: "4242", holder: "Amine Ben Ali" });
  assert.equal(JSON.stringify(kept).includes("123"), false); // the CVC is never kept
  assert.equal(checkCard(card({ number: "9788 0000 0000 0009" }), now).brand, "e-DINAR");
});

test("card: bad number, expired, bad CVC and extra fields are refused", () => {
  const code = (c) => {
    try {
      checkCard(c, now);
      return "ok";
    } catch (err) {
      return err.code;
    }
  };
  assert.equal(code(card({ number: "4242424242424241" })), "INVALID_CARD");
  assert.equal(code(card({ expMonth: "10", expYear: "26" })), "INVALID_CARD");
  assert.equal(code(card({ cvc: "12" })), "INVALID_CARD");
  assert.equal(code(card({ amount: 1 })), "INVALID_CARD"); // the price never comes from the browser
  assert.equal(code(card({ holder: "<script>" })), "INVALID_CARD");
  assert.equal(code(card({ number: "4000000000000002" })), "PAYMENT_DECLINED");
  assert.equal(code(card({ number: "4000000000009995" })), "PAYMENT_DECLINED");
});

test("csv: formulas are neutralised, commas and quotes are escaped", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), "\"'=HYPERLINK(\"\"http://evil\"\")\"");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("Rent, May"), "\"Rent, May\"");
  assert.equal(csvCell("-12.500", true), "-12.500"); // real numbers stay numbers
});
