// The only entry point the UI uses to talk to the backend (the API in server/).
export { ServiceError } from "./errors.js";
export { setUnauthenticatedHandler } from "./api.js";
export { login, register, logout, getCurrentUser, requestPasswordReset, resetPassword } from "./auth.js";
export { getAccounts, createAccount, renameAccount, closeAccount } from "./accounts.js";
export { getCategories, getTransactions, addOperation } from "./transactions.js";
export { planTransferSteps, transfer } from "./transfers.js";
export { getBudgets, setBudget, removeBudget } from "./budgets.js";
export { getMonthSummary, getSpendingByCategory, getBalanceHistory } from "./analytics.js";
export { getSecuritySummary, getAdminUsers, getAuditLogs, revokeUserSessions, setUserDisabled } from "./admin.js";
