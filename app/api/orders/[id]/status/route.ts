import { handleError, json, readJson } from "@/lib/http";
import { changeStatus } from "@/lib/orders/service";

// Body: { "status": "DELIVERED" | "CANCELLED" }
export async function POST(request: Request, { params }: RouteContext<"/api/orders/[id]/status">) {
  try {
    const { id } = await params;
    return json(await changeStatus(id, await readJson(request)));
  } catch (error) {
    return handleError(error);
  }
}
