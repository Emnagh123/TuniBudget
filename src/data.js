// MOCK DATA: the only seed of the project. None of it is real.
// Money is in integer millimes (1 TND = 1000 millimes). Ids are strings named _id,
// dates are ISO 8601 strings, months are "YYYY-MM": this is the shape MongoDB will use.
// Dates are generated relative to today, so the current month always has data.
//
// Demo logins (password for both: demo1234):
//   amine@tunibudget.tn   3 active accounts, 1 closed account, 4 months of history
//   salma@tunibudget.tn   2 accounts

const NOW = new Date();

/** Date (ISO) in a month "monthsAgo" months before now. The day is clamped so it is never in the future. */
function at(monthsAgo, day, hour = 10) {
  const target = new Date(NOW.getFullYear(), NOW.getMonth() - monthsAgo, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  target.setHours(hour, 0, 0, 0);
  if (target > NOW) return new Date(NOW.getTime() - 60000).toISOString();
  return target.toISOString();
}

function monthsAgo(n) {
  return new Date(NOW.getFullYear(), NOW.getMonth() - n, 1);
}

function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function tx(_id, accountId, type, amount, categoryId, description, date) {
  return { _id, accountId, type, amount, categoryId, description, date, transferId: null };
}

/** A transfer is two linked ledger entries (a debit and a credit) sharing one transferId. */
function transferPair(transferId, debitId, creditId, fromId, toId, amount, fromName, toName, date) {
  return [
    { _id: debitId, accountId: fromId, type: "debit", amount, categoryId: "cat_transfer", description: "Transfer to " + toName, date, transferId },
    { _id: creditId, accountId: toId, type: "credit", amount, categoryId: "cat_transfer", description: "Transfer from " + fromName, date, transferId },
  ];
}

const PASSWORD_HASH_DEMO1234 = "mock$2a5b1094";

export const users = [
  { _id: "usr_amine", fullName: "Amine Ben Salah", email: "amine@tunibudget.tn", passwordHash: PASSWORD_HASH_DEMO1234 },
  { _id: "usr_salma", fullName: "Salma Trabelsi", email: "salma@tunibudget.tn", passwordHash: PASSWORD_HASH_DEMO1234 },
];

export const accounts = [
  { _id: "acc_amine_checking", userId: "usr_amine", name: "Checking account", type: "checking", openingBalance: 313380, currency: "TND", status: "active", closedAt: null },
  { _id: "acc_amine_savings", userId: "usr_amine", name: "Savings", type: "savings", openingBalance: 4200000, currency: "TND", status: "active", closedAt: null },
  { _id: "acc_amine_cash", userId: "usr_amine", name: "Cash", type: "cash", openingBalance: 39800, currency: "TND", status: "active", closedAt: null },
  { _id: "acc_amine_travel", userId: "usr_amine", name: "Travel fund", type: "savings", openingBalance: 0, currency: "TND", status: "closed", closedAt: at(1, 2, 12) },
  { _id: "acc_salma_main", userId: "usr_salma", name: "Main account", type: "checking", openingBalance: 350000, currency: "TND", status: "active", closedAt: null },
  { _id: "acc_salma_rainy", userId: "usr_salma", name: "Rainy day fund", type: "savings", openingBalance: 1000000, currency: "TND", status: "active", closedAt: null },
];

export const categories = [
  { _id: "cat_salary", name: "Salary", kind: "income" },
  { _id: "cat_freelance", name: "Freelance", kind: "income" },
  { _id: "cat_other_income", name: "Other income", kind: "income" },
  { _id: "cat_rent", name: "Rent", kind: "expense" },
  { _id: "cat_food", name: "Food", kind: "expense" },
  { _id: "cat_transport", name: "Transport", kind: "expense" },
  { _id: "cat_bills", name: "Bills", kind: "expense" },
  { _id: "cat_leisure", name: "Leisure", kind: "expense" },
  { _id: "cat_health", name: "Health", kind: "expense" },
  { _id: "cat_shopping", name: "Shopping", kind: "expense" },
  { _id: "cat_education", name: "Education", kind: "expense" },
  { _id: "cat_other_expense", name: "Other expenses", kind: "expense" },
  { _id: "cat_transfer", name: "Transfer", kind: "transfer" },
];

// Listed oldest to newest. The ledger order matters: balances are computed in this order.
export const transactions = [
  // ----- 3 month(s) ago -----
  tx("txn_001", "acc_amine_checking", "credit", 1950000, "cat_salary", "Salary, August", at(3, 1, 8)),
  tx("txn_002", "acc_amine_checking", "debit", 650000, "cat_rent", "Rent, August", at(3, 1, 9)),
  tx("txn_003", "acc_amine_checking", "debit", 91400, "cat_food", "Groceries", at(3, 2, 10)),
  tx("txn_004", "acc_amine_checking", "debit", 101200, "cat_bills", "Electricity and water", at(3, 4, 10)),
  tx("txn_005", "acc_amine_checking", "debit", 29900, "cat_bills", "Mobile internet plan", at(3, 5, 10)),
  tx("txn_006", "acc_amine_checking", "debit", 45000, "cat_transport", "Monthly transport pass", at(3, 6, 10)),
  tx("txn_007", "acc_amine_checking", "debit", 98300, "cat_food", "Weekly groceries", at(3, 8, 10)),
  ...transferPair("trf_001", "txn_008", "txn_009", "acc_amine_checking", "acc_amine_cash", 60000, "Checking account", "Cash", at(3, 10, 12)),
  tx("txn_010", "acc_amine_checking", "debit", 48000, "cat_leisure", "Cinema and coffee", at(3, 11, 18)),
  tx("txn_011", "acc_amine_cash", "debit", 9500, "cat_leisure", "Coffee and snacks", at(3, 12, 15)),
  tx("txn_012", "acc_amine_checking", "debit", 72500, "cat_food", "Restaurant dinner", at(3, 14, 20)),
  tx("txn_013", "acc_amine_checking", "debit", 119500, "cat_shopping", "Back-to-school shopping", at(3, 16, 15)),
  tx("txn_014", "acc_amine_checking", "debit", 34000, "cat_leisure", "Weekend outing", at(3, 18, 16)),
  tx("txn_015", "acc_amine_cash", "debit", 7200, "cat_food", "Street food", at(3, 19, 13)),
  tx("txn_016", "acc_amine_checking", "credit", 300000, "cat_freelance", "Freelance gig, logo design", at(3, 20, 9)),
  tx("txn_017", "acc_amine_checking", "debit", 81200, "cat_food", "Groceries", at(3, 20, 11)),
  tx("txn_018", "acc_amine_checking", "debit", 21500, "cat_transport", "Taxi rides", at(3, 22, 17)),
  ...transferPair("trf_002", "txn_019", "txn_020", "acc_amine_checking", "acc_amine_savings", 250000, "Checking account", "Savings", at(3, 25, 10)),
  tx("txn_021", "acc_amine_cash", "debit", 6000, "cat_transport", "Taxi (cash)", at(3, 27, 14)),
  tx("txn_022", "acc_amine_checking", "debit", 26800, "cat_health", "Pharmacy", at(3, 28, 11)),

  // ----- 2 month(s) ago -----
  tx("txn_023", "acc_amine_checking", "credit", 1950000, "cat_salary", "Salary, September", at(2, 1, 8)),
  tx("txn_024", "acc_salma_main", "credit", 1450000, "cat_salary", "Salary, September", at(2, 1, 8)),
  tx("txn_025", "acc_amine_checking", "debit", 650000, "cat_rent", "Rent, September", at(2, 1, 9)),
  tx("txn_026", "acc_salma_main", "debit", 480000, "cat_rent", "Rent, September", at(2, 2, 9)),
  tx("txn_027", "acc_amine_checking", "debit", 86700, "cat_food", "Groceries", at(2, 2, 10)),
  ...transferPair("trf_003", "txn_028", "txn_029", "acc_amine_checking", "acc_amine_travel", 180000, "Checking account", "Travel fund", at(2, 3, 11)),
  tx("txn_030", "acc_amine_checking", "debit", 112800, "cat_bills", "Electricity and water", at(2, 4, 10)),
  tx("txn_031", "acc_amine_checking", "debit", 29900, "cat_bills", "Mobile internet plan", at(2, 5, 10)),
  tx("txn_032", "acc_salma_main", "debit", 132000, "cat_food", "Groceries", at(2, 5, 10)),
  tx("txn_033", "acc_amine_checking", "debit", 45000, "cat_transport", "Monthly transport pass", at(2, 6, 10)),
  tx("txn_034", "acc_amine_checking", "debit", 104100, "cat_food", "Weekly groceries", at(2, 8, 10)),
  tx("txn_035", "acc_salma_main", "debit", 36500, "cat_bills", "Phone and internet", at(2, 9, 11)),
  ...transferPair("trf_004", "txn_036", "txn_037", "acc_amine_checking", "acc_amine_cash", 60000, "Checking account", "Cash", at(2, 10, 12)),
  tx("txn_038", "acc_amine_checking", "debit", 61000, "cat_leisure", "Cinema and coffee", at(2, 11, 18)),
  tx("txn_039", "acc_amine_cash", "debit", 12300, "cat_leisure", "Coffee and snacks", at(2, 12, 15)),
  tx("txn_040", "acc_salma_main", "debit", 62000, "cat_leisure", "Dinner and cinema", at(2, 13, 18)),
  tx("txn_041", "acc_amine_checking", "debit", 88400, "cat_food", "Restaurant dinner", at(2, 14, 20)),
  tx("txn_042", "acc_amine_checking", "credit", 350000, "cat_freelance", "Freelance gig, landing page", at(2, 15, 9)),
  tx("txn_043", "acc_amine_checking", "debit", 132000, "cat_shopping", "Winter clothes", at(2, 16, 15)),
  tx("txn_044", "acc_salma_main", "debit", 71200, "cat_shopping", "Shoes", at(2, 18, 12)),
  tx("txn_045", "acc_amine_checking", "debit", 29500, "cat_leisure", "Weekend outing", at(2, 18, 16)),
  tx("txn_046", "acc_amine_cash", "debit", 8800, "cat_food", "Street food", at(2, 19, 13)),
  ...transferPair("trf_005", "txn_047", "txn_048", "acc_salma_main", "acc_salma_rainy", 200000, "Main account", "Rainy day fund", at(2, 20, 10)),
  tx("txn_049", "acc_amine_checking", "debit", 79800, "cat_food", "Groceries", at(2, 20, 11)),
  tx("txn_050", "acc_amine_travel", "debit", 180000, "cat_leisure", "Weekend trip, hotel", at(2, 20, 12)),
  tx("txn_051", "acc_amine_checking", "debit", 27300, "cat_transport", "Taxi rides", at(2, 22, 17)),
  ...transferPair("trf_006", "txn_052", "txn_053", "acc_amine_checking", "acc_amine_savings", 300000, "Checking account", "Savings", at(2, 25, 10)),
  tx("txn_054", "acc_amine_checking", "debit", 38400, "cat_health", "Pharmacy and dentist", at(2, 26, 11)),
  tx("txn_055", "acc_amine_cash", "debit", 9500, "cat_transport", "Taxi (cash)", at(2, 27, 14)),

  // ----- 1 month(s) ago -----
  tx("txn_056", "acc_amine_checking", "credit", 1950000, "cat_salary", "Salary, October", at(1, 1, 8)),
  tx("txn_057", "acc_salma_main", "credit", 1450000, "cat_salary", "Salary, October", at(1, 1, 8)),
  tx("txn_058", "acc_amine_checking", "debit", 650000, "cat_rent", "Rent, October", at(1, 1, 9)),
  tx("txn_059", "acc_salma_main", "debit", 480000, "cat_rent", "Rent, October", at(1, 2, 9)),
  tx("txn_060", "acc_amine_checking", "debit", 94900, "cat_food", "Groceries", at(1, 2, 10)),
  tx("txn_061", "acc_amine_checking", "debit", 96500, "cat_bills", "Electricity and water", at(1, 4, 10)),
  tx("txn_062", "acc_amine_checking", "debit", 29900, "cat_bills", "Mobile internet plan", at(1, 5, 10)),
  tx("txn_063", "acc_salma_main", "debit", 125000, "cat_food", "Groceries", at(1, 5, 10)),
  tx("txn_064", "acc_amine_checking", "debit", 45000, "cat_transport", "Monthly transport pass", at(1, 6, 10)),
  tx("txn_065", "acc_amine_checking", "debit", 92600, "cat_food", "Weekly groceries", at(1, 8, 10)),
  tx("txn_066", "acc_salma_main", "debit", 36500, "cat_bills", "Phone and internet", at(1, 9, 11)),
  ...transferPair("trf_007", "txn_067", "txn_068", "acc_amine_checking", "acc_amine_cash", 60000, "Checking account", "Cash", at(1, 10, 12)),
  tx("txn_069", "acc_amine_checking", "debit", 52500, "cat_leisure", "Cinema and coffee", at(1, 11, 18)),
  tx("txn_070", "acc_amine_checking", "credit", 420000, "cat_freelance", "Freelance gig, e-commerce site", at(1, 12, 9)),
  tx("txn_071", "acc_amine_cash", "debit", 11000, "cat_leisure", "Coffee and snacks", at(1, 12, 15)),
  tx("txn_072", "acc_salma_main", "debit", 58000, "cat_leisure", "Dinner and cinema", at(1, 13, 18)),
  tx("txn_073", "acc_amine_checking", "debit", 79300, "cat_food", "Restaurant dinner", at(1, 14, 20)),
  tx("txn_074", "acc_amine_checking", "debit", 64500, "cat_shopping", "Autumn jacket", at(1, 16, 15)),
  tx("txn_075", "acc_salma_main", "debit", 71200, "cat_shopping", "Shoes", at(1, 18, 12)),
  tx("txn_076", "acc_amine_checking", "debit", 41000, "cat_leisure", "Weekend outing", at(1, 18, 16)),
  tx("txn_077", "acc_amine_cash", "debit", 9100, "cat_food", "Street food", at(1, 19, 13)),
  ...transferPair("trf_008", "txn_078", "txn_079", "acc_salma_main", "acc_salma_rainy", 200000, "Main account", "Rainy day fund", at(1, 20, 10)),
  tx("txn_080", "acc_amine_checking", "debit", 85200, "cat_food", "Groceries", at(1, 20, 11)),
  tx("txn_081", "acc_amine_checking", "debit", 19800, "cat_transport", "Taxi rides", at(1, 22, 17)),
  ...transferPair("trf_009", "txn_082", "txn_083", "acc_amine_checking", "acc_amine_savings", 350000, "Checking account", "Savings", at(1, 25, 10)),
  tx("txn_084", "acc_amine_cash", "debit", 5500, "cat_transport", "Taxi (cash)", at(1, 27, 14)),

  // ----- current month -----
  tx("txn_085", "acc_amine_checking", "credit", 1950000, "cat_salary", "Salary, November", at(0, 1, 8)),
  tx("txn_086", "acc_salma_main", "credit", 1450000, "cat_salary", "Salary, November", at(0, 1, 8)),
  tx("txn_087", "acc_amine_checking", "debit", 650000, "cat_rent", "Rent, November", at(0, 1, 9)),
  tx("txn_088", "acc_salma_main", "debit", 480000, "cat_rent", "Rent, November", at(0, 2, 9)),
  tx("txn_089", "acc_amine_checking", "debit", 84300, "cat_food", "Groceries", at(0, 2, 10)),
  tx("txn_090", "acc_amine_checking", "debit", 118450, "cat_bills", "Electricity and water", at(0, 3, 10)),
  tx("txn_091", "acc_amine_checking", "debit", 26200, "cat_transport", "Taxi rides", at(0, 4, 10)),
  tx("txn_092", "acc_amine_checking", "debit", 24000, "cat_leisure", "Streaming and gaming", at(0, 4, 21)),
  tx("txn_093", "acc_amine_checking", "debit", 45000, "cat_transport", "Monthly transport pass", at(0, 5, 10)),
  tx("txn_094", "acc_salma_main", "debit", 118000, "cat_food", "Groceries", at(0, 5, 10)),
  tx("txn_095", "acc_amine_checking", "debit", 97200, "cat_food", "Weekly groceries", at(0, 6, 10)),
  tx("txn_096", "acc_amine_checking", "debit", 87900, "cat_shopping", "Clothes shopping", at(0, 7, 15)),
  tx("txn_097", "acc_amine_checking", "debit", 56000, "cat_leisure", "Cinema and coffee", at(0, 8, 18)),
  tx("txn_098", "acc_amine_checking", "debit", 32000, "cat_leisure", "Weekend outing", at(0, 8, 20)),
  tx("txn_099", "acc_amine_checking", "debit", 42600, "cat_health", "Pharmacy", at(0, 9, 11)),
  tx("txn_100", "acc_salma_main", "debit", 36500, "cat_bills", "Phone and internet", at(0, 9, 11)),
  tx("txn_101", "acc_amine_checking", "credit", 400000, "cat_freelance", "Freelance gig, showcase website", at(0, 10, 9)),
  tx("txn_102", "acc_amine_checking", "debit", 92530, "cat_food", "Restaurant dinner", at(0, 10, 20)),
  tx("txn_103", "acc_amine_cash", "debit", 12000, "cat_leisure", "Coffee with friends", at(0, 11, 16)),
  tx("txn_104", "acc_amine_checking", "debit", 29900, "cat_bills", "Mobile internet plan", at(0, 12, 10)),
  tx("txn_105", "acc_salma_main", "debit", 28000, "cat_transport", "Taxi rides", at(0, 12, 13)),
  tx("txn_106", "acc_amine_checking", "debit", 25000, "cat_transport", "Taxi ride home", at(0, 12, 19)),
  ...transferPair("trf_010", "txn_107", "txn_108", "acc_amine_checking", "acc_amine_savings", 300000, "Checking account", "Savings", at(0, 13, 10)),
  tx("txn_109", "acc_salma_main", "debit", 54000, "cat_leisure", "Dinner and cinema", at(0, 13, 18)),
  tx("txn_110", "acc_amine_checking", "debit", 38450, "cat_food", "Neighborhood supermarket", at(0, 14, 10)),
  tx("txn_111", "acc_salma_main", "debit", 71200, "cat_shopping", "Shoes", at(0, 18, 12)),
  ...transferPair("trf_011", "txn_112", "txn_113", "acc_salma_main", "acc_salma_rainy", 200000, "Main account", "Rainy day fund", at(0, 20, 10)),
];

export const budgets = [
  { _id: "bud_001", userId: "usr_amine", categoryId: "cat_food", month: monthKey(monthsAgo(1)), limit: 350000 },
  { _id: "bud_002", userId: "usr_amine", categoryId: "cat_transport", month: monthKey(monthsAgo(1)), limit: 120000 },
  { _id: "bud_003", userId: "usr_amine", categoryId: "cat_bills", month: monthKey(monthsAgo(1)), limit: 200000 },
  { _id: "bud_004", userId: "usr_amine", categoryId: "cat_leisure", month: monthKey(monthsAgo(1)), limit: 100000 },
  { _id: "bud_005", userId: "usr_amine", categoryId: "cat_shopping", month: monthKey(monthsAgo(1)), limit: 150000 },
  { _id: "bud_006", userId: "usr_amine", categoryId: "cat_health", month: monthKey(monthsAgo(1)), limit: 80000 },
  { _id: "bud_007", userId: "usr_amine", categoryId: "cat_food", month: monthKey(monthsAgo(0)), limit: 350000 },
  { _id: "bud_008", userId: "usr_amine", categoryId: "cat_transport", month: monthKey(monthsAgo(0)), limit: 120000 },
  { _id: "bud_009", userId: "usr_amine", categoryId: "cat_bills", month: monthKey(monthsAgo(0)), limit: 200000 },
  { _id: "bud_010", userId: "usr_amine", categoryId: "cat_leisure", month: monthKey(monthsAgo(0)), limit: 100000 },
  { _id: "bud_011", userId: "usr_amine", categoryId: "cat_shopping", month: monthKey(monthsAgo(0)), limit: 150000 },
  { _id: "bud_012", userId: "usr_amine", categoryId: "cat_health", month: monthKey(monthsAgo(0)), limit: 80000 },
  { _id: "bud_013", userId: "usr_salma", categoryId: "cat_food", month: monthKey(monthsAgo(0)), limit: 300000 },
  { _id: "bud_014", userId: "usr_salma", categoryId: "cat_leisure", month: monthKey(monthsAgo(0)), limit: 90000 },
];
