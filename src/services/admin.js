// Admin API. The server checks the admin role on every call: hiding the page is only for comfort.
import { request } from "./api.js";

export function getSecuritySummary() {
  return request("GET", "/admin/security-summary");
}

export function getAdminUsers() {
  return request("GET", "/admin/users");
}

/** level: "" (all), "info", "warn" or "alert". */
export function getAuditLogs({ level = "", page = 1, limit = 25 } = {}) {
  return request("GET", "/admin/audit-logs", { query: { level, page, limit } });
}

/** Every payment (paid and declined) with the payer, and the total paid. */
export function getAdminPayments() {
  return request("GET", "/admin/payments");
}

export function getAdminOffers() {
  return request("GET", "/admin/offers");
}

/** { name, code?, percentOff, intervals, endsAt?, maxUses?, targetEmail? } */
export function createOffer(offer) {
  return request("POST", "/admin/offers", { body: offer });
}

export function setOfferActive(offerId, active) {
  return request("POST", "/admin/offers/" + encodeURIComponent(offerId) + "/active", { body: { active } });
}

export function revokeUserSessions(userId) {
  return request("POST", "/admin/users/" + encodeURIComponent(userId) + "/revoke-sessions");
}

export function setUserDisabled(userId, disabled) {
  return request("POST", "/admin/users/" + encodeURIComponent(userId) + "/disable", { body: { disabled } });
}
