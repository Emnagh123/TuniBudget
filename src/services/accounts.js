import { db, nextId, nextSeq } from "./db.js";
import { ServiceError, delay, validationError, withLock } from "./errors.js";
import { requireUserId } from "./session.js";
import { findOwnedAccount, userAccounts } from "./queries.js";

const ACCOUNT_TYPES = ["checking", "savings", "cash"];

function cleanName(name) {
  const text = String(name || "").trim();
  if (text.length < 2 || text.length > 40) {
    throw validationError("The account name needs 2 to 40 characters.");
  }
  return text;
}

/** Active accounts first, then closed ones. Each account has its last movement date. */
export async function getAccounts() {
  const userId = requireUserId();
  await delay();
  return userAccounts(userId)
    .map((account) => {
      const dates = db.transactions.filter((t) => t.accountId === account._id).map((t) => t.date);
      const lastMovementAt = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
      return { ...account, lastMovementAt };
    })
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
}

export function createAccount({ name, type, initialDeposit = 0 }) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    const cleaned = cleanName(name);
    if (!ACCOUNT_TYPES.includes(type)) throw validationError("Choose an account type.");
    if (!Number.isInteger(initialDeposit) || initialDeposit < 0) {
      throw new ServiceError("INVALID_AMOUNT", "The initial deposit must be 0 or more.");
    }

    const account = {
      _id: nextId("acc"),
      userId,
      name: cleaned,
      type,
      openingBalance: 0,
      balance: initialDeposit,
      currency: "TND",
      status: "active",
      closedAt: null,
    };
    db.accounts = [...db.accounts, account];
    if (initialDeposit > 0) {
      db.transactions = [
        ...db.transactions,
        {
          _id: nextId("txn"),
          accountId: account._id,
          type: "credit",
          amount: initialDeposit,
          categoryId: "cat_other_income",
          description: "Initial deposit",
          date: new Date().toISOString(),
          transferId: null,
          balanceAfter: initialDeposit,
          seq: nextSeq(),
        },
      ];
    }
    return { ...account };
  });
}

export function renameAccount(accountId, name) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    const account = findOwnedAccount(userId, accountId);
    const cleaned = cleanName(name);
    db.accounts = db.accounts.map((a) => (a._id === account._id ? { ...a, name: cleaned } : a));
    return { ...account, name: cleaned };
  });
}

/** An account can only be closed when its balance is exactly 0. Its history is kept. */
export function closeAccount(accountId) {
  const userId = requireUserId();
  return withLock(async () => {
    await delay();
    const account = findOwnedAccount(userId, accountId);
    if (account.status === "closed") throw new ServiceError("ACCOUNT_CLOSED", "This account is already closed.");
    if (account.balance !== 0) {
      throw new ServiceError("ACCOUNT_NOT_EMPTY", "Move the remaining money out of this account before closing it.");
    }
    const closedAt = new Date().toISOString();
    db.accounts = db.accounts.map((a) => (a._id === account._id ? { ...a, status: "closed", closedAt } : a));
    return { ...account, status: "closed", closedAt };
  });
}
