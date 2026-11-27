// Admin routes: security monitoring and user support. Mounted behind requireAuth + requireAdmin,
// so they need a logged-in admin (role read from the database) and, optionally, an allowed IP.
// Every admin action is written to the security log. Admins never see password hashes.
import express from "express";
import { collections } from "../db.js";
import { ApiError } from "../errors.js";
import { audit } from "../security/audit.js";
import { endAllSessions } from "../security/sessions.js";
import { sha256 } from "../security/tokens.js";
import * as v from "../validate.js";
import { planOf } from "../plans.js";
import { publicPayment } from "./billing.js";
import { CODE_PATTERN } from "../offers.js";
import { newId } from "../security/tokens.js";

function publicAdminOffer(o) {
  return {
    _id: o._id,
    name: o.name,
    code: o.code,
    percentOff: o.percentOff,
    intervals: o.intervals,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    maxUses: o.maxUses,
    uses: o.uses,
    active: o.active,
    target: o.targetEmail || null,
    createdAt: o.createdAt,
  };
}

const LEVELS = ["info", "warn", "alert"];

export function adminRoutes() {
  const router = express.Router();

  // Counts of security events over the last 24 hours, and the latest alerts.
  router.get("/security-summary", async (req, res) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [byEvent, alerts, activeSessions] = await Promise.all([
      collections.auditLogs.aggregate([{ $match: { at: { $gte: since } } }, { $group: { _id: "$event", count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray(),
      collections.auditLogs.find({ level: "alert" }).sort({ at: -1 }).limit(20).toArray(),
      collections.sessions.countDocuments({ expiresAt: { $gt: new Date() } }),
    ]);
    res.json({ since, events: byEvent.map((e) => ({ event: e._id, count: e.count })), alerts, activeSessions });
  });

  router.get("/audit-logs", async (req, res) => {
    const filter = {};
    if (req.query.level) filter.level = v.oneOf(req.query.level, LEVELS, "Unknown level.");
    if (req.query.event) {
      if (typeof req.query.event !== "string" || !/^[a-z_]{3,40}$/.test(req.query.event)) throw new ApiError("VALIDATION_ERROR", "Unknown event.");
      filter.event = req.query.event;
    }
    const page = v.intParam(req.query.page, { fallback: 1, min: 1, max: 10000 });
    const limit = v.intParam(req.query.limit, { fallback: 50, min: 1, max: 200 });
    const items = await collections.auditLogs.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    res.json({ items, page, limit });
  });

  router.get("/users", async (req, res) => {
    const users = await collections.users
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    // Payment summary per user: how many paid / declined, total paid, last payment.
    const sums = await collections.payments
      .aggregate([
        {
          $group: {
            _id: "$userId",
            paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
            declinedCount: { $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] } },
            paidTotal: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
            lastPaymentAt: { $max: "$createdAt" },
          },
        },
      ])
      .toArray();
    const byUser = Object.fromEntries(sums.map((s) => [s._id, s]));
    const none = { paidCount: 0, declinedCount: 0, paidTotal: 0, lastPaymentAt: null };
    res.json(
      users.map((u) => {
        const { _id, ...billing } = byUser[u._id] || { _id: null, ...none };
        return { ...u, plan: planOf(u), billing };
      })
    );
  });

  // ----- Discounts and special offers -----
  router.get("/offers", async (req, res) => {
    const offers = await collections.offers.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(offers.map(publicAdminOffer));
  });

  // Creates an offer: a promo code, or an automatic discount for everyone or for one user (by email).
  router.post("/offers", async (req, res) => {
    const body = v.onlyFields(req.body, ["name", "code", "percentOff", "intervals", "endsAt", "maxUses", "targetEmail"]);
    const name = v.text(body.name, { min: 3, max: 50, message: "Give the offer a name (3 to 50 characters)." });
    let code = null;
    if (body.code !== undefined && body.code !== null && body.code !== "") {
      code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
      if (!CODE_PATTERN.test(code)) throw new ApiError("VALIDATION_ERROR", "A promo code uses 3 to 20 letters or digits, without spaces.");
    }
    const percentOff = body.percentOff;
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
      throw new ApiError("VALIDATION_ERROR", "The discount must be a whole number from 1 to 100 %.");
    }
    const intervals = Array.isArray(body.intervals) ? [...new Set(body.intervals)] : [];
    if (intervals.length === 0 || intervals.some((i) => !["monthly", "yearly"].includes(i))) {
      throw new ApiError("VALIDATION_ERROR", "Choose monthly, yearly or both.");
    }
    const endDay = v.optionalDay(body.endsAt);
    const endsAt = endDay ? new Date(endDay + "T23:59:59") : null;
    if (endsAt && endsAt < new Date()) throw new ApiError("VALIDATION_ERROR", "The end date is already past.");
    let maxUses = null;
    if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== "") {
      if (!Number.isInteger(body.maxUses) || body.maxUses < 1 || body.maxUses > 1000000) {
        throw new ApiError("VALIDATION_ERROR", "The number of uses must be a whole number from 1.");
      }
      maxUses = body.maxUses;
    }
    let userId = null;
    let targetEmail = null;
    if (body.targetEmail) {
      targetEmail = v.email(body.targetEmail);
      const target = await collections.users.findOne({ email: targetEmail }, { projection: { _id: 1 } });
      if (!target) throw new ApiError("VALIDATION_ERROR", "No user has this email.");
      userId = target._id;
    }
    if (code && (await collections.offers.findOne({ code }))) throw new ApiError("VALIDATION_ERROR", "This promo code already exists.");

    const offer = {
      _id: newId("off"),
      name,
      code,
      percentOff,
      intervals,
      startsAt: new Date(),
      endsAt,
      maxUses,
      uses: 0,
      userId,
      targetEmail,
      active: true,
      createdAt: new Date(),
      createdBy: req.user._id,
    };
    await collections.offers.insertOne(offer);
    await audit(req, "admin_created_offer", { level: "warn", details: { offerId: offer._id, code, percentOff, targetEmail } });
    res.status(201).json(publicAdminOffer(offer));
  });

  // Pauses or restarts an offer.
  router.post("/offers/:offerId/active", async (req, res) => {
    const offerId = v.id(req.params.offerId, { prefix: "off", code: "NOT_FOUND", message: "This offer does not exist." });
    const body = v.onlyFields(req.body, ["active"]);
    const active = v.bool(body.active);
    const offer = await collections.offers.findOneAndUpdate({ _id: offerId }, { $set: { active } }, { returnDocument: "after" });
    if (!offer) throw new ApiError("NOT_FOUND", "This offer does not exist.");
    await audit(req, active ? "admin_started_offer" : "admin_paused_offer", { level: "warn", details: { offerId } });
    res.json(publicAdminOffer(offer));
  });

  // Every payment (paid and declined), newest first, with the payer's name and email.
  router.get("/payments", async (req, res) => {
    const payments = await collections.payments.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    const ids = [...new Set(payments.map((p) => p.userId))];
    const users = await collections.users.find({ _id: { $in: ids } }, { projection: { fullName: 1, email: 1 } }).toArray();
    const byId = Object.fromEntries(users.map((u) => [u._id, u]));
    const paidTotal = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
    res.json({
      paidTotal,
      items: payments.map((p) => ({ ...publicPayment(p), userId: p.userId, user: byId[p.userId] ? { fullName: byId[p.userId].fullName, email: byId[p.userId].email } : null })),
    });
  });

  // Logs a user out of every device (for example after a suspected account takeover).
  router.post("/users/:userId/revoke-sessions", async (req, res) => {
    const userId = v.id(req.params.userId, { prefix: "usr", code: "NOT_FOUND", message: "This user does not exist." });
    const closed = await endAllSessions(userId);
    await audit(req, "admin_revoked_sessions", { level: "warn", details: { targetUserId: userId, sessionsClosed: closed } });
    res.json({ sessionsClosed: closed });
  });

  // Blocks or unblocks a user. A disabled user cannot log in and all their sessions end.
  router.post("/users/:userId/disable", async (req, res) => {
    const userId = v.id(req.params.userId, { prefix: "usr", code: "NOT_FOUND", message: "This user does not exist." });
    const body = v.onlyFields(req.body, ["disabled"]);
    const disabled = v.bool(body.disabled);
    if (userId === req.user._id) throw new ApiError("VALIDATION_ERROR", "You cannot disable your own account.");
    const result = await collections.users.updateOne({ _id: userId }, { $set: { disabled } });
    if (result.matchedCount === 0) throw new ApiError("NOT_FOUND", "This user does not exist.");
    if (disabled) await endAllSessions(userId);
    await audit(req, disabled ? "admin_disabled_user" : "admin_enabled_user", { level: "warn", details: { targetUserId: userId } });
    res.json({ _id: userId, disabled });
  });

  // Lifts a login lock (5 failed attempts) for one email.
  router.post("/unlock-login", async (req, res) => {
    const body = v.onlyFields(req.body, ["email"]);
    const mail = v.email(body.email);
    await collections.loginThrottle.deleteOne({ _id: sha256(mail) });
    await audit(req, "admin_unlocked_login", { level: "warn" });
    res.json({ unlocked: true });
  });

  return router;
}
