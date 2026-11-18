import { handleError, json, readJson } from "@/lib/http";
import { createOrder, listOrders } from "@/lib/orders/service";

export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    return json(await listOrders({ status }));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    return json(await createOrder(await readJson(request)), 201);
  } catch (error) {
    return handleError(error);
  }
}
