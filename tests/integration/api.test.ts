import { describe, expect, it, vi } from "vitest";
import * as ordersRoute from "@/app/api/orders/route";
import * as orderRoute from "@/app/api/orders/[id]/route";
import * as statusRoute from "@/app/api/orders/[id]/status/route";
import * as revenueRoute from "@/app/api/reports/revenue/route";
import { prisma } from "@/lib/db";

const BASE = "http://localhost/api";

const input = {
  customerName: "Nguyễn Văn A",
  productName: "Bút bi",
  quantity: 2,
  unitPrice: "150000",
};

function jsonRequest(path: string, method: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createViaApi(body: unknown = input) {
  const res = await ordersRoute.POST(jsonRequest("/orders", "POST", body));
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
    expect(body).toMatchObject({
      customerName: "Nguyễn Văn A",
      quantity: 2,
      unitPrice: "150000.00",
      amount: "300000.00",
      status: "NEW",
    });
    expect(typeof body.id).toBe("string");
    expect(typeof body.createdAt).toBe("string");
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
  it("lọc theo status", async () => {
    const { body: a } = await createViaApi();
    const { body: b } = await createViaApi();
    await deliverViaApi(b.id);

    const res = await ordersRoute.GET(new Request(`${BASE}/orders?status=NEW`));
    const list = await res.json();

    expect(res.status).toBe(200);
    expect(list.map((o: { id: string }) => o.id)).toEqual([a.id]);
  });

  it("400 khi status lạ", async () => {
    const res = await ordersRoute.GET(new Request(`${BASE}/orders?status=FOO`));
    expect(res.status).toBe(400);
  });
});

describe("/api/orders/[id]", () => {
  it("GET 200 và 404", async () => {
    const { body: created } = await createViaApi();

    const ok = await orderRoute.GET(new Request(`${BASE}/orders/${created.id}`), ctx(created.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).amount).toBe("300000.00");

    const missing = await orderRoute.GET(new Request(`${BASE}/orders/x`), ctx("x"));
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toEqual(expect.any(String));
  });

  it("PATCH đơn NEW tính lại amount; PATCH đơn đã giao → 422", async () => {
    const { body: created } = await createViaApi();

    const patch = () =>
      orderRoute.PATCH(
        jsonRequest(`/orders/${created.id}`, "PATCH", { ...input, quantity: 3 }),
        ctx(created.id),
      );

    const ok = await patch();
    expect(ok.status).toBe(200);
    expect((await ok.json()).amount).toBe("450000.00");

    await deliverViaApi(created.id);
    const locked = await patch();
    expect(locked.status).toBe(422);
  });

  it("DELETE đơn NEW → 204; đơn đã giao → 422", async () => {
    const { body: fresh } = await createViaApi();
    const del = await orderRoute.DELETE(new Request(`${BASE}/orders/${fresh.id}`), ctx(fresh.id));
    expect(del.status).toBe(204);

    const { body: delivered } = await createViaApi();
    await deliverViaApi(delivered.id);
    const locked = await orderRoute.DELETE(
      new Request(`${BASE}/orders/${delivered.id}`),
      ctx(delivered.id),
    );
    expect(locked.status).toBe(422);
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

  it("409 khi đơn bị đổi ở nơi khác giữa lúc đọc và ghi", async () => {
    const { body: created } = await createViaApi();
    const staleSnapshot = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    await deliverViaApi(created.id);
    // Simulates a concurrent request winning the race: the service still reads
    // the old NEW snapshot, but the DB row is already DELIVERED, so the
    // conditional update matches nothing.
    const spy = vi.spyOn(prisma.order, "findUnique").mockResolvedValueOnce(staleSnapshot);

    const res = await statusRoute.POST(
      jsonRequest(`/orders/${created.id}/status`, "POST", { status: "CANCELLED" }),
      ctx(created.id),
    );
    spy.mockRestore();

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

    const res = await revenueRoute.GET(new Request(`${BASE}/reports/revenue`));
    const report = await res.json();

    expect(res.status).toBe(200);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ orders: 1, revenue: "300000.00" });
    expect(report.total).toEqual({ orders: 1, revenue: "300000.00" });
  });

  it("400 khi from > to", async () => {
    const res = await revenueRoute.GET(
      new Request(`${BASE}/reports/revenue?from=2026-11-18&to=2026-11-01`),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.to).toEqual([expect.any(String)]);
  });
});

describe("lỗi không mong đợi", () => {
  it("500 không lộ chi tiết lỗi", async () => {
    const spy = vi.spyOn(prisma.order, "findMany").mockRejectedValueOnce(new Error("secret"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await ordersRoute.GET(new Request(`${BASE}/orders`));
    spy.mockRestore();
    log.mockRestore();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
