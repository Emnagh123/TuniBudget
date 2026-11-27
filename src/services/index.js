// The only entry point the UI uses to talk to the backend (the API in server/).
export { ServiceError } from "./errors.js";
export { setUnauthenticatedHandler } from "./api.js";
export { login, register, logout, getCurrentUser, requestPasswordReset, resetPassword } from "./auth.js";
export { getAccounts, createAccount, renameAccount, closeAccount } from "./accounts.js";
export { getCategories, getTransactions, addOperation, exportTransactionsCsv } from "./transactions.js";
export { planTransferSteps, transfer } from "./transfers.js";
export { getBudgets, setBudget, removeBudget, copyPreviousBudgets } from "./budgets.js";
export { getMonthSummary, getSpendingByCategory, getBalanceHistory } from "./analytics.js";
export { getSecuritySummary, getAdminUsers, getAdminPayments, getAdminOffers, createOffer, setOfferActive, getAuditLogs, revokeUserSessions, setUserDisabled } from "./admin.js";
export { getPlans, getQuote, getMyBilling, checkout, cancelPremium } from "./billing.js";
