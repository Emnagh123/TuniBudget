// In-memory "database", built from the mock data in ../data.js.
// Only the services import this file. Pages and components must never import it.
import * as seed from "../data.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

// Seeding: order the ledger, then compute each balanceAfter and each account balance.
function buildLedger(accountList, transactionList) {
  const balances = {};
  for (const account of accountList) balances[account._id] = account.openingBalance;

  const ordered = transactionList
    .map((t, index) => ({ ...t, seq: index + 1 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date) || a.seq - b.seq)
    .map((t, index) => ({ ...t, seq: index + 1 }));

  for (const t of ordered) {
    balances[t.accountId] += t.type === "credit" ? t.amount : -t.amount;
    t.balanceAfter = balances[t.accountId];
  }
  const withBalances = accountList.map((a) => ({ ...a, balance: balances[a._id] }));
  return { accounts: withBalances, transactions: ordered };
}

const ledger = buildLedger(clone(seed.accounts), clone(seed.transactions));

export const db = {
  users: clone(seed.users),
  accounts: ledger.accounts,
  categories: clone(seed.categories),
  transactions: ledger.transactions,
  budgets: clone(seed.budgets),
};

// Id generator (a real database would create the _id values itself).
const counters = {};
export function nextId(prefix) {
  counters[prefix] = (counters[prefix] || 1000) + 1;
  return prefix + "_" + counters[prefix];
}

let seqCounter = db.transactions.length;
export function nextSeq() {
  seqCounter += 1;
  return seqCounter;
}

export function publicUser(user) {
  return { _id: user._id, fullName: user.fullName, email: user.email };
}
