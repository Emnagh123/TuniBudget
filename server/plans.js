// The plans and what each one allows. This file is the single source of truth: the routes
// enforce these limits on the server, and the browser only shows them (a hidden button is not
// a security check).
//
//   free     0 TND                      the default for every new account
//   premium  9.900 TND/month, 99 TND/year  paid with the simulated checkout (routes/billing.js)
//   admins get every Premium feature without paying.

export const PRICES = {
  monthly: { amount: 9_900, months: 1, label: "Monthly" }, // millimes: 9.900 TND
  yearly: { amount: 99_000, months: 12, label: "Yearly" }, // 99.000 TND (2 months free)
};

const PERKS = {
  free: {
    maxOpenAccounts: 3,
    historyMonths: 3, // the current month and the 2 before it
    budgetsAnyMonth: false,
    copyBudgets: false,
    csvExport: false,
    chartDays: [30, 90],
  },
  premium: {
    maxOpenAccounts: 100, // "unlimited" for a person, with a technical ceiling
    historyMonths: null, // no limit
    budgetsAnyMonth: true,
    copyBudgets: true,
    csvExport: true,
    chartDays: [30, 90, 365],
  },
};

/** "premium" while a paid period is running (or for admins), otherwise "free". */
export function planOf(user, now = new Date()) {
  if (!user) return "free";
  if (user.role === "admin") return "premium";
  return user.premiumUntil && new Date(user.premiumUntil) > now ? "premium" : "free";
}

export function perksOf(user, now) {
  return PERKS[planOf(user, now)];
}

/** First day of the oldest month a free user may see, e.g. Sep 1 when today is in November. */
export function historyStart(perks, now = new Date()) {
  if (!perks.historyMonths) return null;
  return new Date(now.getFullYear(), now.getMonth() - (perks.historyMonths - 1), 1);
}

/** The new end of the paid period: added to what is left, so paying early never loses days. */
export function extendPremium(currentUntil, months, now = new Date()) {
  const start = currentUntil && new Date(currentUntil) > now ? new Date(currentUntil) : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end;
}

export function monthKeyOf(date = new Date()) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}
