import { describe, expect, it, vi } from "vitest";
import * as healthRoute from "@/app/api/health/route";
import * as ordersRoute from "@/app/api/orders/route";
import * as orderRoute from "@/app/api/orders/[id]/route";
import * as historyRoute from "@/app/api/orders/[id]/history/route";
import * as statusRoute from "@/app/api/orders/[id]/status/route";
import * as revenueRoute from "@/app/api/reports/revenue/route";
import { prisma } from "@/lib/db";

// connection() needs a Next request scope; route handlers called directly in
// tests have none, so stub it to a no-op (it only marks the route dynamic).
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const BASE = "http://localhost/api";

const input = {
  customerName: "Nguyễn Văn A",
  productName: "Bút bi",
  quantity: 2,
  unitPrice: "150000",
};

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`${BASE}${path}`, init);
}

function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  init: { headers?: Record<string, string> } = {},
): Request {
  return request(path, {
    method,
    headers: { "content-type": "application/json", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createViaApi(body: unknown = input, headers?: Record<string, string>) {
  const res = await ordersRoute.POST(jsonRequest("/orders", "POST", body, { headers }));
  return { res, body: await res.json() };
}

async function deliverViaApi(id: string) {
  return statusRoute.POST(
    jsonRequest(`/orders/${id}/status`, "POST", { status: "DELIVERED" }),
    ctx(id),
  );
}

describe("POST /api/orders", () => {
  it("201, tiền là string, server tự tính amount và đặt NEW", async () => {
    const { res, body } = await createViaApi({ ...input, amount: "1", status: "DELIVERED" });

    expect(res.status).toBe(201);
    expect(res.headers.get("location")).toBe(`/api/orders/${body.id}`);
    expect(body).toMatchObject({
      customerName: "Nguyễn Văn A",
      quantity: 2,
      unitPrice: "150000.00",
      amount: "300000.00",
      status: "NEW",
      version: 1,
    });
    expect(typeof body.id).toBe("string");
    expect(typeof body.createdAt).toBe("string");
  });

  it("Idempotency-Key: gửi lại → 200 + Idempotent-Replayed, cùng đơn", async () => {
    const headers = { "idempotency-key": "khoa-api-000001" };
    const first = await createViaApi(input, headers);
    const again = await createViaApi(input, headers);

    expect(first.res.status).toBe(201);
    expect(again.res.status).toBe(200);
    expect(again.res.headers.get("idempotent-replayed")).toBe("true");
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("400 kèm lỗi theo field khi quantity = 0", async () => {
    const { res, body } = await createViaApi({ ...input, quantity: 0 });

    expect(res.status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
    expect(body.fieldErrors.quantity).toEqual([expect.any(String)]);
    expect(await prisma.order.count()).toBe(0);
  });

  it("400 (không phải 500) khi body không phải JSON", async () => {
    const { res, body } = await createViaApi("{không phải json");
    expect(res.status).toBe(400);
    expect(body.error).toEqual(expect.any(String));
  });
});

describe("GET /api/orders", () => {
  it("lọc theo status, trả { items, nextCursor }", async () => {
    const { body: a } = await createViaApi();
    const { body: b } = await createViaApi();
    await deliverViaApi(b.id);

    const res = await ordersRoute.GET(request("/orders?status=NEW"));
    const page = await res.json();

    expect(res.status).toBe(200);
    expect(page.items.map((o: { id: string }) => o.id)).toEqual([a.id]);
    expect(page.nextCursor).toBeNull();
  });

  it("phân trang với limit và cursor", async () => {
    for (let i = 0; i < 3; i++) await createViaApi();

    const first = await (await ordersRoute.GET(request("/orders?limit=2"))).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await (
      await ordersRoute.GET(request(`/orders?limit=2&cursor=${first.nextCursor}`))
    ).json();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it.each(["status=FOO", "limit=0", "limit=abc", "cursor=xyz"])("400 khi %s", async (query) => {
    const res = await ordersRoute.GET(request(`/orders?${query}`));
    expect(res.status).toBe(400);
  });
});

describe("/api/orders/[id]", () => {
  it("GET 200 và 404", async () => {
    const { body: created } = await createViaApi();

    const ok = await orderRoute.GET(request(`/orders/${created.id}`), ctx(created.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).amount).toBe("300000.00");

    const missing = await orderRoute.GET(request("/orders/x"), ctx("x"));
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toEqual(expect.any(String));
  });

  it("PATCH đơn NEW tính lại amount; version cũ → 409; đơn đã giao → 422", async () => {
    const { body: created } = await createViaApi();

    const patch = (quantity: number, version: number) =>
      orderRoute.PATCH(
        jsonRequest(`/orders/${created.id}`, "PATCH", { ...input, quantity, version }),
        ctx(created.id),
      );

    const ok = await patch(3, 1);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ amount: "450000.00", version: 2 });

    const stale = await patch(4, 1);
    expect(stale.status).toBe(409);

    await deliverViaApi(created.id);
    const locked = await patch(5, 3);
    expect(locked.status).toBe(422);
  });

  it("PATCH thiếu version → 400 kèm lỗi ở field version", async () => {
    const { body: created } = await createViaApi();
    const res = await orderRoute.PATCH(
      jsonRequest(`/orders/${created.id}`, "PATCH", input),
      ctx(created.id),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.version).toEqual([expect.any(String)]);
  });

  it("DELETE đơn NEW → 204 rồi 404; đơn đã giao → 422; version cũ → 409", async () => {
    const del = (id: string, query = "") =>
      orderRoute.DELETE(request(`/orders/${id}${query}`, { method: "DELETE" }), ctx(id));

    const { body: fresh } = await createViaApi();
    expect((await del(fresh.id, "?version=1")).status).toBe(204);
    expect((await orderRoute.GET(request(`/orders/${fresh.id}`), ctx(fresh.id))).status).toBe(404);

    const { body: delivered } = await createViaApi();
    await deliverViaApi(delivered.id);
    expect((await del(delivered.id)).status).toBe(422);

    const { body: edited } = await createViaApi();
    await orderRoute.PATCH(
      jsonRequest(`/orders/${edited.id}`, "PATCH", { ...input, quantity: 9, version: 1 }),
      ctx(edited.id),
    );
    expect((await del(edited.id, "?version=1")).status).toBe(409);
  });

  it("GET history trả lịch sử theo thứ tự", async () => {
    const { body: created } = await createViaApi();
    await deliverViaApi(created.id);

    const res = await historyRoute.GET(request(`/orders/${created.id}/history`), ctx(created.id));
    const events = await res.json();

    expect(res.status).toBe(200);
    expect(events.map((e: { type: string }) => e.type)).toEqual(["CREATED", "STATUS_CHANGED"]);
  });
});

describe("POST /api/orders/[id]/status", () => {
  it("200 khi NEW → DELIVERED; 422 khi đổi tiếp", async () => {
    const { body: created } = await createViaApi();

    const ok = await deliverViaApi(created.id);
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("DELIVERED");

    const again = await statusRoute.POST(
      jsonRequest(`/orders/${created.id}/status`, "POST", { status: "CANCELLED" }),
      ctx(created.id),
    );
    expect(again.status).toBe(422);
  });

  it("400 khi status không hợp lệ", async () => {
    const { body: created } = await createViaApi();
    const res = await statusRoute.POST(
      jsonRequest(`/orders/${created.id}/status`, "POST", { status: "NEW" }),
      ctx(created.id),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.status).toEqual([expect.any(String)]);
  });

  it("409 khi đơn đã bị sửa ở nơi khác (version cũ)", async () => {
    const { body: created } = await createViaApi();
    await orderRoute.PATCH(
      jsonRequest(`/orders/${created.id}`, "PATCH", { ...input, quantity: 5, version: 1 }),
      ctx(created.id),
    );

    const res = await statusRoute.POST(
      jsonRequest(`/orders/${created.id}/status`, "POST", { status: "DELIVERED", version: 1 }),
      ctx(created.id),
    );
    expect(res.status).toBe(409);
  });

  it("404 khi id không tồn tại", async () => {
    const res = await deliverViaApi("khong-ton-tai");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/reports/revenue", () => {
  it("200 với dữ liệu đơn đã giao, tiền là string", async () => {
    const { body: created } = await createViaApi();
    await deliverViaApi(created.id);

    const res = await revenueRoute.GET(request("/reports/revenue"));
    const report = await res.json();

    expect(res.status).toBe(200);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ orders: 1, revenue: "300000.00" });
    expect(report.total).toEqual({ orders: 1, revenue: "300000.00" });
  });

  it("400 khi from > to", async () => {
    const res = await revenueRoute.GET(request("/reports/revenue?from=2026-11-18&to=2026-11-01"));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.to).toEqual([expect.any(String)]);
  });
});

describe("GET /api/health", () => {
  it("200 khi DB trả lời, không cần đăng nhập", async () => {
    const res = await healthRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("503 khi DB không trả lời", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("down"));
    const res = await healthRoute.GET();
    spy.mockRestore();
    expect(res.status).toBe(503);
  });
});

describe("lỗi không mong đợi", () => {
  it("500 không lộ chi tiết lỗi, trả request id và ghi log có cấu trúc", async () => {
    const spy = vi.spyOn(prisma.order, "findMany").mockRejectedValueOnce(new Error("secret"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await ordersRoute.GET(
      request("/orders", { headers: { "x-request-id": "req-123" } }),
    );
    const logged = JSON.parse(String(log.mock.calls[0]?.[0]));
    spy.mockRestore();
    log.mockRestore();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body.requestId).toBe("req-123");
    expect(logged).toMatchObject({
      level: "error",
      requestId: "req-123",
      error: { message: "secret" },
    });
  });
});
