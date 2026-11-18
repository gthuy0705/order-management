import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/sessions";
import { authenticate } from "@/lib/auth/users";
import { handleError, readJson } from "@/lib/http";

// Body: { "username", "password" }. Sets the session cookie and also returns
// the token, so scripts can use `Authorization: Bearer <token>` instead.
export async function POST(request: Request) {
  try {
    const user = await authenticate(await readJson(request));
    if (!user) {
      return NextResponse.json({ error: "Sai tên đăng nhập hoặc mật khẩu." }, { status: 401 });
    }
    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({ token, expiresAt: expiresAt.toISOString(), user });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return handleError(error, request);
  }
}
