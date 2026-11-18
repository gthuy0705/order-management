import { SESSION_COOKIE, getSessionUser } from "./sessions";
import { UnauthorizedError } from "./errors";
import type { SessionUser } from "./users";

// API clients may send `Authorization: Bearer <token>` (curl, scripts) or the
// session cookie set by the login page / POST /api/auth/login.
export function sessionTokenFrom(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim() || null;

  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}

// Every API route calls this first; there is no anonymous access.
export async function requireApiUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(sessionTokenFrom(request));
  if (!user) throw new UnauthorizedError();
  return user;
}
