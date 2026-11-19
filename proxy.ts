import { NextResponse, type NextRequest } from "next/server";
import { isSafeRequestId, REQUEST_ID_HEADER } from "@/lib/log";

// Runs before every page and API request and gives it an id (kept from
// upstream if safe) that route handlers log and return on 500s, and that the
// client sees as a response header.
export function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = isSafeRequestId(incoming) ? incoming : crypto.randomUUID();

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
