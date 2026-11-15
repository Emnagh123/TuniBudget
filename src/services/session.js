// Current session. It plays the role of the auth token that a real API would read
// from the Authorization header: services never receive the user as an argument.
import { ServiceError } from "./errors.js";

let currentUserId = null;

export function setSession(userId) {
  currentUserId = userId;
}

export function clearSession() {
  currentUserId = null;
}

export function requireUserId() {
  if (!currentUserId) {
    throw new ServiceError("UNAUTHENTICATED", "You must be logged in to do this.");
  }
  return currentUserId;
}
