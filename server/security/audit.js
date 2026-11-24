// Security log and monitoring.
// Every security event is written as one JSON line to the console (for the host's log viewer)
// and stored in the auditLogs collection (for the admin routes). Passwords, tokens and
// cookies are never logged.
//
// Monitoring: when one IP produces too many suspicious events in a short time, a
// "suspicious_activity" alert is raised, and sent to ALERT_WEBHOOK_URL if it is set.
import { collections } from "../db.js";

const SUSPICIOUS_EVENTS = [
  "login_failed",
  "account_locked",
  "rate_limited",
  "csrf_blocked",
  "injection_blocked",
  "admin_denied",
  "reset_link_invalid",
  "access_denied",
  "https_required",
];
const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 10;
const recentAlerts = new Map(); // ip -> time of the last alert, so one attacker does not flood the alerts

let settings = { alertWebhookUrl: "" };
export function configureAudit(config) {
  settings = { alertWebhookUrl: config.alertWebhookUrl };
}

function clean(details) {
  const copy = { ...details };
  for (const key of Object.keys(copy)) {
    if (/password|token|cookie|secret|hash/i.test(key)) delete copy[key];
  }
  return copy;
}

/**
 * Records a security event.
 * level: "info" (normal), "warn" (something was blocked), "alert" (needs a human).
 */
export async function audit(req, event, { level = "info", userId = null, details = {} } = {}) {
  const entry = {
    at: new Date(),
    event,
    level,
    userId: userId || (req && req.user ? req.user._id : null),
    ip: req ? req.ip : null,
    method: req ? req.method : null,
    path: req ? String(req.originalUrl || req.path).split("?")[0].slice(0, 120) : null,
    userAgent: req ? String(req.get("user-agent") || "").slice(0, 200) : null,
    requestId: req ? req.id : null,
    details: clean(details),
  };
  const line = JSON.stringify({ type: "security", ...entry });
  if (level === "info") console.log(line);
  else console.warn(line);

  try {
    if (collections.auditLogs) await collections.auditLogs.insertOne(entry);
    if (SUSPICIOUS_EVENTS.includes(event) && entry.ip) await checkForAttack(req, entry.ip);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "audit log write failed", error: err.message }));
  }
}

async function checkForAttack(req, ip) {
  const last = recentAlerts.get(ip) || 0;
  if (Date.now() - last < WINDOW_MS) return;
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await collections.auditLogs.countDocuments({ ip, event: { $in: SUSPICIOUS_EVENTS }, at: { $gte: since } });
  if (count < THRESHOLD) return;

  recentAlerts.set(ip, Date.now());
  const alert = {
    at: new Date(),
    event: "suspicious_activity",
    level: "alert",
    userId: null,
    ip,
    method: null,
    path: null,
    userAgent: String(req.get("user-agent") || "").slice(0, 200),
    requestId: req.id,
    details: { blockedEventsInLast15Minutes: count },
  };
  console.warn(JSON.stringify({ type: "security", ...alert }));
  await collections.auditLogs.insertOne(alert);
  await notify(alert);
}

async function notify(alert) {
  if (!settings.alertWebhookUrl) return;
  try {
    // Plain JSON body: works with Slack/Discord-style incoming webhooks and most alerting tools.
    await fetch(settings.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `TuniBudget security alert: ${alert.details.blockedEventsInLast15Minutes} blocked requests from ${alert.ip} in 15 minutes.`,
        content: `TuniBudget security alert: ${alert.details.blockedEventsInLast15Minutes} blocked requests from ${alert.ip} in 15 minutes.`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "alert webhook failed", error: err.message }));
  }
}
