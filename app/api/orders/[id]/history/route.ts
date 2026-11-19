import { handleError, json } from "@/lib/http";
import { getOrderHistory } from "@/lib/orders/service";

// Audit trail of one order, oldest first.
export async function GET(request: Request, { params }: RouteContext<"/api/orders/[id]/history">) {
  try {
    const { id } = await params;
    return json(await getOrderHistory(id));
  } catch (error) {
    return handleError(error, request);
  }
}
