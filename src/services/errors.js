// Every service failure is a ServiceError with a stable `code` and a readable `message`
// (the same codes the API sends back, see server/errors.js).
export class ServiceError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    Object.assign(this, extra);
  }
}
