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

export function revokeUserSessions(userId) {
  return request("POST", "/admin/users/" + encodeURIComponent(userId) + "/revoke-sessions");
}

export function setUserDisabled(userId, disabled) {
  return request("POST", "/admin/users/" + encodeURIComponent(userId) + "/disable", { body: { disabled } });
}
