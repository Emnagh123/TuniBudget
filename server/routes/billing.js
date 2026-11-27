// Plans and the SIMULATED checkout. Paying stores a payment in the `payments` collection and
// upgrades the user to Premium, both in one ACID transaction (either both happen or neither).
//
// Security rules:
//   - The price comes from server/plans.js. The browser only says "monthly" or "yearly"; an
//     amount sent by the browser is refused, so nobody can pay 0.001 TND for a year.
//   - The card number and CVC are checked in memory and thrown away. Only brand + last 4 are kept.
//   - An Idempotency-Key makes a double click charge once.
//   - Every payment, success or refusal, is written to the audit log.
import express from "express";
import { collections, inTransaction } from "../db.js";
import { ApiError } from "../errors.js";
import { claim, previousResponse, remember } from "../idempotency.js";
import { checkCard } from "../card.js";
import { PRICES, extendPremium, perksOf, planOf } from "../plans.js";
import { CODE_PATTERN, quote, useOffer } from "../offers.js";
import { audit } from "../security/audit.js";
import { moneyLimiter } from "../security/rateLimits.js";
import { newId } from "../security/tokens.js";
import * as v from "../validate.js";
import { publicUser } from "./auth.js";

export function publicPayment(p) {
  return {
    _id: p._id,
    plan: p.plan,
    interval: p.interval,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    card: p.card,
    originalAmount: p.originalAmount ?? p.amount,
    offer: p.offer || null,
    periodEnd: p.periodEnd,
    createdAt: p.createdAt,
  };
}

// "ramadan30 " -> "RAMADAN30". Empty means no code.
function promoCode(value) {
  if (value === undefined || value === null || value === "") return null;
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CODE_PATTERN.test(code)) throw new ApiError("INVALID_PROMO", "This promo code is not valid for this plan.");
  return code;
}

// Before sign-up (no session): the prices with the offer for everyone, and promo code checks.
// Nothing here is personal or changes data.
export function publicBillingRoutes() {
  const router = express.Router();
  router.get("/plans", async (req, res) => {
    const prices = [];
    for (const [interval, p] of Object.entries(PRICES)) {
      const q = await quote({ interval, userId: null });
      prices.push({ interval, months: p.months, label: p.label, originalAmount: q.originalAmount, amount: q.amount, offer: q.offer });
    }
    res.json({ prices });
  });
  router.get("/quote", async (req, res) => {
    const interval = v.oneOf(req.query.interval, Object.keys(PRICES), "Choose monthly or yearly.");
    res.json(await quote({ interval, code: promoCode(req.query.code), userId: null }));
  });
  return router;
}

export function billingRoutes() {
  const router = express.Router();

  // The price list, with the automatic offer (if any) already applied for this user.
  router.get("/plans", async (req, res) => {
    const prices = [];
    for (const [interval, p] of Object.entries(PRICES)) {
      const q = await quote({ interval, userId: req.user._id });
      prices.push({ interval, months: p.months, label: p.label, originalAmount: q.originalAmount, amount: q.amount, offer: q.offer });
    }
    res.json({ prices, free: perksOf({ role: "user" }), premium: perksOf({ role: "admin" }) });
  });

  // Checks a promo code and returns the price with it (shown before paying).
  router.get("/quote", async (req, res) => {
    const interval = v.oneOf(req.query.interval, Object.keys(PRICES), "Choose monthly or yearly.");
    res.json(await quote({ interval, code: promoCode(req.query.code), userId: req.user._id }));
  });

  // The user's plan and their own payments (newest first).
  router.get("/me", async (req, res) => {
    const payments = await collections.payments.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ user: publicUser(req.user), payments: payments.map(publicPayment) });
  });

  router.post("/checkout", moneyLimiter, async (req, res) => {
    const earlier = await previousResponse(req);
    if (earlier) return res.status(earlier.status).json(earlier.body);

    const body = v.onlyFields(req.body, ["interval", "card", "promoCode"]);
    const interval = v.oneOf(body.interval, Object.keys(PRICES), "Choose monthly or yearly.");
    const code = promoCode(body.promoCode);
    const price = PRICES[interval];
    const planned = await quote({ interval, code, userId: req.user._id }); // a bad code fails before the card is used
    const user = req.user;
    if (user.role === "admin") throw new ApiError("VALIDATION_ERROR", "Admins already have every Premium feature.");

    let card;
    try {
      card = checkCard(body.card);
    } catch (err) {
      if (err.code === "PAYMENT_DECLINED") {
        // A refused payment is stored too, like a bank statement shows a declined attempt.
        await collections.payments.insertOne({
          _id: newId("pay"),
          userId: user._id,
          plan: "premium",
          interval,
          amount: planned.amount,
          originalAmount: planned.originalAmount,
          offer: planned.offer,
          currency: "TND",
          status: "declined",
          card: err.extra.card,
          reason: err.message,
          periodEnd: null,
          createdAt: new Date(),
        });
        await audit(req, "payment_declined", { level: "warn", userId: user._id, details: { interval, last4: err.extra.card.last4 } });
      } else {
        await audit(req, "payment_invalid_card", { level: "info", userId: user._id });
      }
      throw err;
    }

    const result = await inTransaction(async (session) => {
      const key = await claim(req, session);
      const now = new Date();
      // The price is computed again inside the transaction, from the stored offer.
      const final = await quote({ interval, code, userId: user._id, session });
      if (final.offer) await useOffer(final.offer, session);
      const fresh = await collections.users.findOne({ _id: user._id }, { session });
      const premiumUntil = extendPremium(fresh.premiumUntil, price.months, now);
      const payment = {
        _id: newId("pay"),
        userId: user._id,
        plan: "premium",
        interval,
        amount: final.amount, // from the server's price list and offer, never from the browser
        originalAmount: final.originalAmount,
        offer: final.offer,
        currency: "TND",
        status: "paid",
        card: { brand: card.brand, last4: card.last4 },
        holder: card.holder,
        periodEnd: premiumUntil,
        createdAt: now,
      };
      await collections.payments.insertOne(payment, { session });
      await collections.users.updateOne(
        { _id: user._id },
        { $set: { plan: "premium", premiumUntil, premiumSince: fresh.premiumSince || now } },
        { session }
      );
      const response = {
        status: 201,
        body: { payment: publicPayment(payment), user: publicUser({ ...fresh, plan: "premium", premiumUntil }) },
      };
      await remember(key, response, session);
      return response;
    });

    await audit(req, "payment_succeeded", {
      userId: user._id,
      details: { paymentId: result.body.payment._id, interval, amount: result.body.payment.amount, offer: result.body.payment.offer && result.body.payment.offer.name },
    });
    res.status(result.status).json(result.body);
  });

  // Stop renewing: in this simulation nothing renews by itself, so cancelling just ends Premium now.
  router.post("/cancel", async (req, res) => {
    if (planOf(req.user) !== "premium" || req.user.role === "admin") {
      throw new ApiError("VALIDATION_ERROR", "You are not on a paid Premium plan.");
    }
    await collections.users.updateOne({ _id: req.user._id }, { $set: { plan: "free", premiumUntil: null } });
    await audit(req, "premium_cancelled", { userId: req.user._id });
    res.json({ user: publicUser({ ...req.user, plan: "free", premiumUntil: null }) });
  });

  return router;
}
