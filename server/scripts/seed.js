// Fills MongoDB with the demo data of src/data.js (the same data the app used before the backend).
//   npm run seed             only when the database is empty
//   npm run seed -- --reset  wipes the app's collections first (refused in production)
import { loadConfig } from "../config.js";
import { client, collections, connect } from "../db.js";
import { hashPassword } from "../security/password.js";
import * as seed from "../../src/data.js";

const DEMO_PASSWORD = "demo1234";
// Development-only admin login (the seed refuses to run in production).
// Amine is a Premium demo user (paid yearly with the 4242 test card); Salma stays on the free plan.
const PREMIUM_DEMO = "usr_amine";
const DEMO_ADMIN = { _id: "usr_admin", fullName: "TuniBudget Admin", email: "admin@tunibudget.tn", password: "admin1234" };
const reset = process.argv.includes("--reset");
const config = loadConfig();

if (config.isProduction) {
  console.error("[seed] Refused: never load demo users with a known password into a production database.");
  process.exit(1);
}

await connect(config);
try {
  const existing = await collections.users.countDocuments();
  if (existing > 0 && !reset) {
    console.error("[seed] The database already has users. Run `npm run seed -- --reset` to wipe it and start again.");
    process.exit(1);
  }
  if (reset) {
    for (const name of ["users", "accounts", "categories", "transactions", "budgets", "sessions", "passwordResets", "loginThrottle", "idempotencyKeys", "payments", "offers"]) {
      await collections[name].deleteMany({});
    }
  }

  // Same ledger rules as before: order by date, then compute each balanceAfter and each balance.
  const balances = Object.fromEntries(seed.accounts.map((a) => [a._id, a.openingBalance]));
  const owner = Object.fromEntries(seed.accounts.map((a) => [a._id, a.userId]));
  const ordered = seed.transactions
    .map((t, index) => ({ ...t, seq: index + 1 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date) || a.seq - b.seq)
    .map((t, index) => {
      balances[t.accountId] += t.type === "credit" ? t.amount : -t.amount;
      return { ...t, userId: owner[t.accountId], date: new Date(t.date), seq: index + 1, balanceAfter: balances[t.accountId] };
    });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const yearLater = new Date(now);
  yearLater.setFullYear(yearLater.getFullYear() + 1);
  await collections.users.insertMany(
    seed.users.map((u) => ({
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      passwordHash,
      role: "user",
      plan: u._id === PREMIUM_DEMO ? "premium" : "free",
      premiumUntil: u._id === PREMIUM_DEMO ? yearLater : null,
      premiumSince: u._id === PREMIUM_DEMO ? now : null,
      createdAt: now,
      passwordChangedAt: now,
    }))
  );
  // A sample promo code the admin can pause or copy: 20 % off both plans.
  await collections.offers.insertOne({
    _id: "off_seed_welcome",
    name: "Welcome offer",
    code: "WELCOME20",
    percentOff: 20,
    intervals: ["monthly", "yearly"],
    startsAt: now,
    endsAt: null,
    maxUses: null,
    uses: 0,
    userId: null,
    targetEmail: null,
    active: true,
    createdAt: now,
    createdBy: DEMO_ADMIN._id,
  });
  await collections.payments.insertOne({
    _id: "pay_seed_amine",
    userId: PREMIUM_DEMO,
    plan: "premium",
    interval: "yearly",
    amount: 99_000,
    currency: "TND",
    status: "paid",
    card: { brand: "Visa", last4: "4242" },
    holder: "Amine Ben Salah",
    periodEnd: yearLater,
    createdAt: now,
  });
  await collections.accounts.insertMany(
    seed.accounts.map((a) => ({ ...a, balance: balances[a._id], closedAt: a.closedAt ? new Date(a.closedAt) : null, createdAt: now }))
  );
  await collections.users.insertOne({
    _id: DEMO_ADMIN._id,
    fullName: DEMO_ADMIN.fullName,
    email: DEMO_ADMIN.email,
    passwordHash: await hashPassword(DEMO_ADMIN.password),
    role: "admin",
    createdAt: now,
    passwordChangedAt: now,
  });
  await collections.accounts.insertOne({
    _id: "acc_admin_checking",
    userId: DEMO_ADMIN._id,
    name: "Checking account",
    type: "checking",
    openingBalance: 0,
    balance: 0,
    currency: "TND",
    status: "active",
    closedAt: null,
    createdAt: now,
  });
  await collections.categories.insertMany(seed.categories.map((c) => ({ ...c })));
  await collections.transactions.insertMany(ordered);
  await collections.budgets.insertMany(seed.budgets.map((b) => ({ ...b })));

  console.log(`[seed] Done: ${seed.users.length} users, ${seed.accounts.length} accounts, ${ordered.length} transactions, ${seed.budgets.length} budgets.`);
  console.log(`[seed] Demo logins: ${seed.users.map((u) => u.email).join(", ")} with password ${DEMO_PASSWORD}`);
  console.log("[seed] amine@tunibudget.tn is Premium (with one payment), salma@tunibudget.tn is on the free plan.");
  console.log(`[seed] Admin login: ${DEMO_ADMIN.email} with password ${DEMO_ADMIN.password}`);
} finally {
  await client.close();
}
