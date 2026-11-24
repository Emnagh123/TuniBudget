// Password hashing with scrypt (built into Node.js, memory-hard, recommended by OWASP).
// Stored format: scrypt$N$r$p$salt$hash   (salt and hash in base64url)
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * PARAMS.N * PARAMS.r * 2; // what scrypt needs, with room to spare

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time comparison. Returns false for any malformed stored hash. */
export async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltText, keyText] = parts;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every(Number.isInteger) || N > 2 ** 20 || R > 16 || P > 4) return false;
  const expected = Buffer.from(keyText, "base64url");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltText, "base64url"), expected.length, {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** True when a hash was made with weaker settings than today's: it is upgraded at the next login. */
export function needsRehash(stored) {
  return stored !== undefined && !String(stored).startsWith(`scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$`);
}

// A real hash of a random password. Checking it when the email is unknown makes the
// response time the same as for a wrong password, so attackers cannot guess which emails exist.
let dummyHash = null;
export async function burnTime(password) {
  if (!dummyHash) dummyHash = await hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, dummyHash);
}
