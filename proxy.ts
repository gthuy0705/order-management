import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSafeRequestId, REQUEST_ID_HEADER } from "@/lib/log";

// Runs before every page and API request:
// 1. gives the request an id (kept from upstream if safe) that route handlers
//    log and return on 500s, and that the client sees as a response header;
// 2. sends visitors without a session cookie to /login. This is only an
//    optimistic redirect for a nicer UX — whether the session is actually
//    valid is checked again next to every data read and mutation
//    (requireUser / requireApiUser). API routes answer 401 themselves.
export function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = isSafeRequestId(incoming) ? incoming : crypto.randomUUID();

  const { pathname, search } = request.nextUrl;
  const isPublic = pathname === "/login" || pathname.startsWith("/api/");
  if (!isPublic && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    const response = NextResponse.redirect(login);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  // Everything except build assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
