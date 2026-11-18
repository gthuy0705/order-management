import { handleError, json, readJson } from "@/lib/http";
import { deleteOrder, getOrder, updateOrder } from "@/lib/orders/service";

type Context = RouteContext<"/api/orders/[id]">;

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return json(await getOrder(id));
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return json(await updateOrder(id, await readJson(request)));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteOrder(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
