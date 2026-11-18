import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "./sessions";
import type { SessionUser } from "./users";

// For pages and Server Actions. Reads the request cookie, so callers must sit
// inside a <Suspense> boundary (cacheComponents).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

// proxy.ts only redirects optimistically (cookie present or not); this is the
// real check, done next to every data read and every mutation.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
