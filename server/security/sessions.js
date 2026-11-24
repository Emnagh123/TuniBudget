// Server-side sessions kept in MongoDB, identified by a random token in a hardened cookie.
//
// Cookie: HttpOnly (JavaScript cannot read it, so XSS cannot steal it), Secure (HTTPS only, in
// production), SameSite=Strict (never sent by other sites: CSRF protection), and the __Host- prefix
// in production (the browser refuses it unless it is Secure, on "/" and bound to this exact host).
//
// The database only stores an HMAC fingerprint of the token. A session ends after
// SESSION_TTL_HOURS, after SESSION_IDLE_MINUTES without activity, at logout, or when the password changes.
import { collections } from "../db.js";
import { fingerprint, randomToken } from "./tokens.js";

let settings;
export function configureSessions(config) {
  settings = {
    secret: config.sessionSecret,
    secure: config.isProduction || Boolean(config.tlsCertFile),
    cookieName: config.isProduction ? "__Host-tb_session" : "tb_session",
    ttlMs: config.sessionHours * 3600 * 1000,
    idleMs: config.sessionIdleMinutes * 60 * 1000,
  };
}

function readCookie(req, name) {
  const header = req.get("cookie");
  if (!header) return "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : "";
    }
  }
  return "";
}

function writeCookie(res, value, maxAgeSeconds) {
  const parts = [
    `${settings.cookieName}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (settings.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/** Starts a fresh session (a new token every login, so an old token can never be reused: no session fixation). */
export async function startSession(req, res, user) {
  const token = randomToken(32);
  const now = new Date();
  await collections.sessions.insertOne({
    _id: fingerprint(settings.secret, token),
    userId: user._id,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + settings.ttlMs),
    ip: req.ip,
    userAgent: String(req.get("user-agent") || "").slice(0, 200),
  });
  writeCookie(res, token, Math.floor(settings.ttlMs / 1000));
}

/** Finds the session of the request. Returns null when there is none or it has expired. */
export async function readSession(req) {
  const token = readCookie(req, settings.cookieName);
  if (!token) return null;
  const id = fingerprint(settings.secret, token);
  const session = await collections.sessions.findOne({ _id: id });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + settings.idleMs <= now) {
    await collections.sessions.deleteOne({ _id: id });
    return null;
  }
  // Sliding idle timeout. Written at most once a minute to keep reads cheap.
  if (now - session.lastSeenAt.getTime() > 60 * 1000) {
    await collections.sessions.updateOne({ _id: id }, { $set: { lastSeenAt: new Date(now) } });
  }
  return session;
}

export async function endSession(req, res) {
  const token = readCookie(req, settings.cookieName);
  if (token) await collections.sessions.deleteOne({ _id: fingerprint(settings.secret, token) });
  writeCookie(res, "", 0);
}

/** Logs a user out everywhere (after a password change or by an admin). */
export async function endAllSessions(userId) {
  const result = await collections.sessions.deleteMany({ userId });
  return result.deletedCount;
}
