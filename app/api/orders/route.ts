import { requireApiUser } from "@/lib/auth/request";
import { handleError, json, readJson } from "@/lib/http";
import { createOrder, listOrders } from "@/lib/orders/service";

// GET /api/orders?status=&limit=&cursor=  →  { items, nextCursor }
export async function GET(request: Request) {
  try {
    await requireApiUser(request);
    const params = new URL(request.url).searchParams;
    return json(
      await listOrders({
        status: params.get("status") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
      }),
    );
  } catch (error) {
    return handleError(error, request);
  }
}

// Optional header `Idempotency-Key`: resending the same key returns the order
// created the first time (200 + Idempotent-Replayed) instead of a duplicate.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { order, replayed } = await createOrder(user, await readJson(request), {
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    return replayed
      ? json(order, 200, { "Idempotent-Replayed": "true" })
      : json(order, 201, { Location: `/api/orders/${order.id}` });
  } catch (error) {
    return handleError(error, request);
  }
}
