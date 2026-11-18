import { requireApiUser } from "@/lib/auth/request";
import { handleError, json, readJson } from "@/lib/http";
import { deleteOrder, getOrder, updateOrder } from "@/lib/orders/service";

type Context = RouteContext<"/api/orders/[id]">;

export async function GET(request: Request, { params }: Context) {
  try {
    await requireApiUser(request);
    const { id } = await params;
    return json(await getOrder(id));
  } catch (error) {
    return handleError(error, request);
  }
}

// Body must include the `version` returned by GET (optimistic locking).
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await params;
    return json(await updateOrder(user, id, await readJson(request)));
  } catch (error) {
    return handleError(error, request);
  }
}

// DELETE /api/orders/:id?version=N  (version optional)
export async function DELETE(request: Request, { params }: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await params;
    const version = new URL(request.url).searchParams.get("version") ?? undefined;
    await deleteOrder(user, id, { version });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error, request);
  }
}
