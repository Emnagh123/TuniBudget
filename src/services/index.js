// The only entry point the UI uses to talk to the "backend".
// Later, the body of these functions will call the real API (see agent.md, section 8).
export { settings, ServiceError } from "./errors.js";
export { login, register, logout } from "./auth.js";
export { getAccounts, createAccount, renameAccount, closeAccount } from "./accounts.js";
export { getCategories, getTransactions, addOperation } from "./transactions.js";
export { planTransferSteps, transfer } from "./transfers.js";
export { getBudgets, setBudget, removeBudget } from "./budgets.js";
export { getMonthSummary, getSpendingByCategory, getBalanceHistory } from "./analytics.js";
