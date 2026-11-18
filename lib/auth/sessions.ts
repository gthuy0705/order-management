import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { SessionUser } from "./users";

export { SESSION_COOKIE } from "./constants";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The DB keeps only a hash of the token: a leaked dump cannot be used to log in.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, username: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true, // not readable from JavaScript (XSS cannot steal it)
    sameSite: "lax" as const, // not sent on cross-site POSTs (CSRF)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
