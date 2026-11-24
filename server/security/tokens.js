// Random tokens and their fingerprints. Only fingerprints are stored in the database, so a
// leaked database dump cannot be used to log in or to reset a password.
import { createHash, createHmac, randomBytes } from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Keyed fingerprint (HMAC-SHA256) of a session token: useless without SESSION_SECRET. */
export function fingerprint(secret, token) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Document id with a readable prefix: "acc_" + time (sortable) + random part, e.g. "acc_0193a1f2c4d8e1a2b3c4d5e6". */
export function newId(prefix) {
  return prefix + "_" + Date.now().toString(16).padStart(12, "0") + randomBytes(6).toString("hex");
}

// Tie-breaker for ledger entries written at the same instant (debit then credit of a transfer).
let counter = 0;
export function nextSeq() {
  counter = (counter + 1) % 1000;
  return Date.now() * 1000 + counter;
}
