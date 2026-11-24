// Rate limiting per IP address. Limits are kept in memory: with several server instances, plug a
// shared store into express-rate-limit (for example rate-limit-mongo or a Redis store).
import { rateLimit } from "express-rate-limit";
import { audit } from "./audit.js";

function limiter({ name, windowMinutes, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      audit(req, "rate_limited", { level: "warn", details: { limiter: name } });
      res.status(429).json({ error: { code: "RATE_LIMITED", message } });
    },
  });
}

/** Every API call: generous, it only stops floods and scrapers. */
export const apiLimiter = limiter({
  name: "api",
  windowMinutes: 15,
  limit: 900,
  message: "Too many requests. Please wait a few minutes and try again.",
});

/** Log in: only failed attempts count. Stops password guessing from one IP. */
export const loginLimiter = limiter({
  name: "login",
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many failed log-in attempts. Please wait 15 minutes and try again.",
});

/** Account creation. */
export const registerLimiter = limiter({
  name: "register",
  windowMinutes: 60,
  limit: 5,
  message: "Too many accounts created from this network. Please try again later.",
});

/** Password reset emails and reset attempts. */
export const resetLimiter = limiter({
  name: "password-reset",
  windowMinutes: 60,
  limit: 5,
  message: "Too many password reset requests. Please try again in an hour.",
});

/** Money movements: no legitimate user makes 30 transfers a minute. */
export const moneyLimiter = limiter({
  name: "money",
  windowMinutes: 1,
  limit: 30,
  message: "Too many operations in a short time. Please wait a minute.",
});
