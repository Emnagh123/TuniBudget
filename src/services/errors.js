// Shared building blocks of the fake API: errors, simulated latency and the global lock.

/** Runtime settings. Tests set latencyMs to 0. */
export const settings = { latencyMs: 180 };

/** Every service failure is a ServiceError with a stable `code` and a readable `message`. */
export class ServiceError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    Object.assign(this, extra);
  }
}

export function validationError(message) {
  return new ServiceError("VALIDATION_ERROR", message);
}

/** Simulated network latency. */
export function delay(ms = settings.latencyMs) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Global lock queue: write operations run one after the other.
// This simulates row locking (SELECT ... FOR UPDATE): a second operation waits for
// the first one to finish, then works with the up-to-date data.
let queue = Promise.resolve();

export function withLock(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}
