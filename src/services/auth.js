import { request } from "./api.js";

export function login(email, password) {
  return request("POST", "/auth/login", { body: { email: String(email || ""), password: String(password || "") } });
}

export function register({ fullName, email, password }) {
  return request("POST", "/auth/register", { body: { fullName, email, password } });
}

export function logout() {
  return request("POST", "/auth/logout");
}

/** The logged-in user, or null (used to restore the session after a page reload). */
export async function getCurrentUser() {
  try {
    const result = await request("GET", "/auth/me");
    return result.user;
  } catch (err) {
    if (err.code === "UNAUTHENTICATED") return null;
    throw err;
  }
}

export function requestPasswordReset(email) {
  return request("POST", "/auth/password-reset/request", { body: { email: String(email || "") } });
}

export function resetPassword(token, password) {
  return request("POST", "/auth/password-reset/confirm", { body: { token, password: String(password || "") } });
}
