import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, OrderLockedError } from "@/lib/orders/errors";
import {
  changeStatus,
  createOrder,
  deleteOrder,
  getOrder,
  getOrderHistory,
  listOrders,
  updateOrder,
  type OrderDTO,
} from "@/lib/orders/service";

const input = {
  customerName: "Nguyễn Văn A",
  productName: "Bút bi",
  quantity: 3,
  unitPrice: "12500.50",
};

async function create(extra: Record<string, unknown> = {}): Promise<OrderDTO> {
  return (await createOrder({ ...input, ...extra })).order;
}

async function createWithStatus(status: "DELIVERED" | "CANCELLED"): Promise<OrderDTO> {
  const order = await create();
  return changeStatus(order.id, { status });
}

describe("createOrder", () => {
  it("tính amount = quantity × unitPrice ở server, bỏ qua amount client gửi", async () => {
    const order = await create({ amount: "1" });

    expect(order.amount).toBe("37501.50");
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.amount.toFixed(2)).toBe("37501.50");
  });

  it("đơn mới luôn là NEW, version 1, kể cả khi client gửi status/version", async () => {
    const order = await create({ status: "DELIVERED", version: 99 });
    expect(order.status).toBe("NEW");
    expect(order.version).toBe(1);
  });

  it.each([{ quantity: 0 }, { quantity: -2 }, { unitPrice: "0" }, { unitPrice: "-1000" }])(
    "từ chối %j bằng ZodError và không ghi gì vào DB",
    async (override) => {
      await expect(createOrder({ ...input, ...override })).rejects.toBeInstanceOf(ZodError);
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.orderEvent.count()).toBe(0);
    },
  );

  it("trả tiền dạng string", async () => {
    const order = await create();
    expect(order.unitPrice).toBe("12500.50");
    expect(order.amount).toBe("37501.50");
  });
});

describe("createOrder với Idempotency-Key", () => {
  const key = "khoa-thu-lai-0001";

  it("gửi lại cùng key → trả đúng đơn cũ, không tạo đơn trùng", async () => {
    const first = await createOrder(input, { idempotencyKey: key });
    const again = await createOrder(input, { idempotencyKey: key });

    expect(first.replayed).toBe(false);
    expect(again.replayed).toBe(true);
    expect(again.order.id).toBe(first.order.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("hai request đồng thời cùng key → chỉ một đơn được tạo", async () => {
    const results = await Promise.all([
      createOrder(input, { idempotencyKey: key }),
      createOrder(input, { idempotencyKey: key }),
    ]);

    expect(results[0].order.id).toBe(results[1].order.id);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("key khác nhau → hai đơn; không có key → luôn tạo mới", async () => {
    await createOrder(input, { idempotencyKey: "khoa-thu-nhat" });
    await createOrder(input, { idempotencyKey: "khoa-thu-hai" });
    await createOrder(input);
    await createOrder(input);
    expect(await prisma.order.count()).toBe(4);
  });

  it("key quá ngắn → ZodError", async () => {
    await expect(createOrder(input, { idempotencyKey: "abc" })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("changeStatus", () => {
  it.each(["DELIVERED", "CANCELLED"] as const)("NEW → %s thành công, version tăng", async (status) => {
    const order = await create();
    const updated = await changeStatus(order.id, { status });
    expect(updated.status).toBe(status);
    expect(updated.version).toBe(2);
  });

  it.each([
    ["DELIVERED", "CANCELLED"],
    ["DELIVERED", "DELIVERED"],
    ["CANCELLED", "DELIVERED"],
    ["CANCELLED", "CANCELLED"],
  ] as const)("đơn %s không đổi được sang %s; DB giữ nguyên", async (from, to) => {
    const order = await createWithStatus(from);

    await expect(changeStatus(order.id, { status: to })).rejects.toBeInstanceOf(
      OrderLockedError,
    );
    expect((await getOrder(order.id)).status).toBe(from);
  });

  it("không cho đổi về NEW (ZodError)", async () => {
    const order = await create();
    await expect(changeStatus(order.id, { status: "NEW" })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("version cũ → ConflictError, trạng thái không đổi", async () => {
    const order = await create();
    await updateOrder(order.id, { ...input, quantity: 5, version: order.version });

    await expect(
      changeStatus(order.id, { status: "DELIVERED", version: order.version }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await getOrder(order.id)).status).toBe("NEW");
  });

  it("hai yêu cầu đồng thời: đúng một thành công, trạng thái cuối khớp", async () => {
    const order = await create();

    const results = await Promise.allSettled([
      changeStatus(order.id, { status: "DELIVERED" }),
      changeStatus(order.id, { status: "CANCELLED" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The loser either lost the conditional update (Conflict) or read the
    // order after the winner committed (Locked); both are correct refusals.
    const reason: unknown = rejected[0].reason;
    expect(reason instanceof ConflictError || reason instanceof OrderLockedError).toBe(true);

    expect((await getOrder(order.id)).status).toBe(fulfilled[0].value.status);
  });
});

describe("updateOrder", () => {
  it("sửa đơn NEW: amount được tính lại, version tăng", async () => {
    const order = await create();

    const updated = await updateOrder(order.id, {
      ...input,
      quantity: 10,
      unitPrice: "2000",
      amount: "999",
      version: order.version,
    });

    expect(updated.quantity).toBe(10);
    expect(updated.amount).toBe("20000.00");
    expect(updated.version).toBe(order.version + 1);
  });

  it("thiếu version → ZodError (không cho sửa mù)", async () => {
    const order = await create();
    await expect(updateOrder(order.id, { ...input, quantity: 4 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("version cũ → ConflictError, thay đổi của người kia được giữ", async () => {
    const order = await create();
    await updateOrder(order.id, { ...input, quantity: 7, version: order.version });

    await expect(
      updateOrder(order.id, { ...input, quantity: 99, version: order.version }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await getOrder(order.id)).quantity).toBe(7);
  });

  it("hai người sửa đồng thời trên cùng version: đúng một người thắng", async () => {
    const order = await create();

    const results = await Promise.allSettled([
      updateOrder(order.id, { ...input, quantity: 11, version: order.version }),
      updateOrder(order.id, { ...input, quantity: 22, version: order.version }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);

    const after = await getOrder(order.id);
    expect(after.quantity).toBe(fulfilled[0].value.quantity);
    expect(after.version).toBe(2);
  });

  it("lưu mà không đổi gì → không tăng version, không ghi lịch sử", async () => {
    const order = await create();
    const same = await updateOrder(order.id, { ...input, version: order.version });

    expect(same.version).toBe(order.version);
    expect(await prisma.orderEvent.count({ where: { type: "UPDATED" } })).toBe(0);
  });

  it("sửa đơn đã giao → OrderLockedError, dữ liệu không đổi", async () => {
    const order = await createWithStatus("DELIVERED");

    await expect(
      updateOrder(order.id, { ...input, quantity: 99, version: order.version }),
    ).rejects.toBeInstanceOf(OrderLockedError);

    const after = await getOrder(order.id);
    expect(after.quantity).toBe(input.quantity);
    expect(after.amount).toBe(order.amount);
  });

  it("input không hợp lệ → ZodError", async () => {
    const order = await create();
    await expect(
      updateOrder(order.id, { ...input, quantity: 0, version: order.version }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("deleteOrder (xóa mềm)", () => {
  it("xóa đơn NEW: biến mất khỏi get/list nhưng bản ghi và lịch sử vẫn còn", async () => {
    const order = await create();
    await deleteOrder(order.id);

    await expect(getOrder(order.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listOrders()).items).toHaveLength(0);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.deletedAt).not.toBeNull();
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events.map((e) => e.type)).toEqual(["CREATED", "DELETED"]);
  });

  it("đơn đã xóa không sửa/đổi trạng thái/xóa lại được (404)", async () => {
    const order = await create();
    await deleteOrder(order.id);

    await expect(
      updateOrder(order.id, { ...input, version: order.version + 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(changeStatus(order.id, { status: "DELIVERED" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(deleteOrder(order.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(["DELIVERED", "CANCELLED"] as const)("không xóa được đơn %s", async (status) => {
    const order = await createWithStatus(status);
    await expect(deleteOrder(order.id)).rejects.toBeInstanceOf(OrderLockedError);
    expect((await getOrder(order.id)).status).toBe(status);
  });

  it("version cũ → ConflictError, đơn vẫn còn", async () => {
    const order = await create();
    await updateOrder(order.id, { ...input, quantity: 8, version: order.version });

    await expect(deleteOrder(order.id, { version: order.version })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await getOrder(order.id)).quantity).toBe(8);
  });
});

describe("lịch sử thay đổi (audit trail)", () => {
  it("ghi lại từng thay đổi, theo thứ tự, kèm giá trị cũ → mới", async () => {
    const order = await create();
    await updateOrder(order.id, { ...input, quantity: 4, version: order.version });
    await changeStatus(order.id, { status: "DELIVERED" });

    const history = await getOrderHistory(order.id);

    expect(history.map((e) => e.type)).toEqual(["CREATED", "UPDATED", "STATUS_CHANGED"]);
    expect(history[0].changes).toMatchObject({ quantity: 3, amount: "37501.50" });
    expect(history[1].changes).toEqual({
      quantity: { from: 3, to: 4 },
      amount: { from: "37501.50", to: "50002.00" },
    });
    expect(history[2]).toMatchObject({ fromStatus: "NEW", toStatus: "DELIVERED" });
  });

  it("thao tác bị từ chối không để lại dòng lịch sử nào", async () => {
    const order = await createWithStatus("DELIVERED");
    await expect(changeStatus(order.id, { status: "CANCELLED" })).rejects.toThrow();
    expect(await prisma.orderEvent.count()).toBe(2); // CREATED + STATUS_CHANGED
  });

  it("bảng lịch sử chỉ ghi thêm: Postgres chặn UPDATE và DELETE", async () => {
    const order = await create();
    const event = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: order.id } });

    await expect(
      prisma.orderEvent.update({ where: { id: event.id }, data: { type: "DELETED" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.orderEvent.delete({ where: { id: event.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it("đơn không tồn tại → NotFoundError", async () => {
    await expect(getOrderHistory("khong-ton-tai")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("id không tồn tại → NotFoundError", () => {
  const missing = "khong-ton-tai";

  it("getOrder", async () => {
    await expect(getOrder(missing)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updateOrder", async () => {
    await expect(updateOrder(missing, { ...input, version: 1 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("changeStatus", async () => {
    await expect(changeStatus(missing, { status: "DELIVERED" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("deleteOrder", async () => {
    await expect(deleteOrder(missing)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listOrders", () => {
  it("lọc theo trạng thái, mới nhất trước", async () => {
    const first = await create();
    const second = await create();
    await createWithStatus("DELIVERED");

    const result = await listOrders({ status: "NEW" });
    expect(result.items.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(result.nextCursor).toBeNull();
  });

  it("phân trang bằng cursor: đi hết các trang, không trùng, không sót", async () => {
    const created: string[] = [];
    for (let i = 0; i < 5; i++) created.push((await create()).id);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await listOrders({ limit: 2, cursor });
      seen.push(...page.items.map((o) => o.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual([...created].reverse());
  });

  it("đơn tạo cùng một thời điểm vẫn được phân trang đúng (so thêm id)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await create()).id);
    const sameInstant = new Date("2026-11-18T03:00:00Z");
    await prisma.order.updateMany({ data: { createdAt: sameInstant } });

    const page1 = await listOrders({ limit: 2 });
    const page2 = await listOrders({ limit: 2, cursor: page1.nextCursor ?? undefined });
    const all = [...page1.items, ...page2.items].map((o) => o.id);

    expect(all).toHaveLength(3);
    expect(new Set(all)).toEqual(new Set(ids));
    expect(page2.nextCursor).toBeNull();
  });

  it.each([{ status: "FOO" }, { cursor: "rác" }, { limit: 0 }, { limit: 101 }])(
    "%j → ZodError",
    async (filter) => {
      await expect(listOrders(filter)).rejects.toBeInstanceOf(ZodError);
    },
  );
});

describe("CHECK constraint (lớp phòng thủ thứ hai)", () => {
  it.each([
    { quantity: 0, unitPrice: "1000" },
    { quantity: 1, unitPrice: "0" },
  ])("Postgres từ chối insert trực tiếp %j", async ({ quantity, unitPrice }) => {
    // Bypasses the service on purpose to prove the DB rejects bad data alone.
    await expect(
      prisma.order.create({
        data: { customerName: "x", productName: "y", quantity, unitPrice, amount: "0" },
      }),
    ).rejects.toThrow(/orders_(quantity|unit_price)_positive/);
  });
});
