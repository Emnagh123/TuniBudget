import { db, nextId, publicUser } from "./db.js";
import { ServiceError, delay, validationError, withLock } from "./errors.js";
import { clearSession, setSession } from "./session.js";
import { mockHash } from "../utils/hash.js";

export async function login(email, password) {
  await delay();
  const user = db.users.find((u) => u.email === String(email).trim().toLowerCase());
  if (!user || user.passwordHash !== mockHash(String(password))) {
    throw new ServiceError("INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  setSession(user._id);
  return { user: publicUser(user), token: "mock-token-" + user._id };
}

export function register({ fullName, email, password }) {
  return withLock(async () => {
    await delay();
    const name = String(fullName || "").trim();
    const mail = String(email || "").trim().toLowerCase();
    if (name.length < 2) throw validationError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw validationError("Enter a valid email address.");
    if (String(password || "").length < 8) throw validationError("The password needs at least 8 characters.");
    if (db.users.some((u) => u.email === mail)) {
      throw new ServiceError("EMAIL_TAKEN", "An account with this email already exists.");
    }

    const user = { _id: nextId("usr"), fullName: name, email: mail, passwordHash: mockHash(password) };
    const firstAccount = {
      _id: nextId("acc"),
      userId: user._id,
      name: "Checking account",
      type: "checking",
      openingBalance: 0,
      balance: 0,
      currency: "TND",
      status: "active",
      closedAt: null,
    };
    db.users = [...db.users, user];
    db.accounts = [...db.accounts, firstAccount];
    setSession(user._id);
    return { user: publicUser(user), token: "mock-token-" + user._id };
  });
}

export async function logout() {
  await delay(0);
  clearSession();
}
