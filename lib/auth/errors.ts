// Thrown by API routes when the request carries no valid session (→ 401).
export class UnauthorizedError extends Error {
  constructor() {
    super("Bạn cần đăng nhập.");
    this.name = "UnauthorizedError";
  }
}
