import { requireApiUser } from "@/lib/auth/request";
import { handleError, json } from "@/lib/http";
import { revenueByDay } from "@/lib/reports/revenue";

// GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: last 30 days)
export async function GET(request: Request) {
  try {
    await requireApiUser(request);
    const params = new URL(request.url).searchParams;
    const report = await revenueByDay({
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return json(report);
  } catch (error) {
    return handleError(error, request);
  }
}
