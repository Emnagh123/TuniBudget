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
    res.json(users);
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
