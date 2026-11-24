import { request } from "./api.js";

/** Active accounts first, then closed ones. Each account has its last movement date. */
export function getAccounts() {
  return request("GET", "/accounts");
}

export function createAccount({ name, type, initialDeposit = 0 }) {
  return request("POST", "/accounts", { body: { name, type, initialDeposit } });
}

export function renameAccount(accountId, name) {
  return request("PATCH", "/accounts/" + encodeURIComponent(accountId), { body: { name } });
}

/** An account can only be closed when its balance is exactly 0. Its history is kept. */
export function closeAccount(accountId) {
  return request("POST", "/accounts/" + encodeURIComponent(accountId) + "/close");
}
