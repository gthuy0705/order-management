import { connection } from "next/server";
import { isDatabaseReachable } from "@/lib/db";

// For load balancers / uptime monitors. Public, and reveals nothing but up/down.
export async function GET() {
  // Must run per request: a health check baked in at build time would lie.
  await connection();
  const database = await isDatabaseReachable();
  return Response.json(
    { status: database ? "ok" : "error", database: database ? "ok" : "unreachable" },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
