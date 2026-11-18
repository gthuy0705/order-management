import { NextResponse } from "next/server";
import { sessionTokenFrom } from "@/lib/auth/request";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/sessions";
import { handleError } from "@/lib/http";

// Revokes the session server-side (the token stops working everywhere).
export async function POST(request: Request) {
  try {
    await deleteSession(sessionTokenFrom(request));
    const response = new NextResponse(null, { status: 204 });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    return handleError(error, request);
  }
}
