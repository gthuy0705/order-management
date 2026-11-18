import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, OrderLockedError } from "@/lib/orders/errors";
import {
  changeStatus,
  createOrder,
  deleteOrder,
  getOrder,
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

async function createWithStatus(status: "DELIVERED" | "CANCELLED"): Promise<OrderDTO> {
  const order = await createOrder(input);
  return changeStatus(order.id, { status });
}

describe("createOrder", () => {
  it("tính amount = quantity × unitPrice ở server, bỏ qua amount client gửi", async () => {
    const order = await createOrder({ ...input, amount: "1" });

    expect(order.amount).toBe("37501.50");
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.amount.toFixed(2)).toBe("37501.50");
  });

  it("đơn mới luôn là NEW kể cả khi client gửi status DELIVERED", async () => {
    const order = await createOrder({ ...input, status: "DELIVERED" });
    expect(order.status).toBe("NEW");
  });

  it.each([{ quantity: 0 }, { quantity: -2 }, { unitPrice: "0" }, { unitPrice: "-1000" }])(
    "từ chối %j bằng ZodError và không ghi gì vào DB",
    async (override) => {
      await expect(createOrder({ ...input, ...override })).rejects.toBeInstanceOf(ZodError);
      expect(await prisma.order.count()).toBe(0);
    },
  );

  it("trả tiền dạng string", async () => {
    const order = await createOrder(input);
    expect(order.unitPrice).toBe("12500.50");
    expect(order.amount).toBe("37501.50");
  });
});

describe("changeStatus", () => {
  it.each(["DELIVERED", "CANCELLED"] as const)("NEW → %s thành công", async (status) => {
    const order = await createOrder(input);
    const updated = await changeStatus(order.id, { status });
    expect(updated.status).toBe(status);
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
    const order = await createOrder(input);
    await expect(changeStatus(order.id, { status: "NEW" })).rejects.toBeInstanceOf(ZodError);
  });

  it("hai yêu cầu đồng thời: đúng một thành công, trạng thái cuối khớp", async () => {
    const order = await createOrder(input);

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
  it("sửa đơn NEW: amount được tính lại", async () => {
    const order = await createOrder(input);

    const updated = await updateOrder(order.id, {
      ...input,
      quantity: 10,
      unitPrice: "2000",
      amount: "999",
    });

    expect(updated.quantity).toBe(10);
    expect(updated.amount).toBe("20000.00");
  });

  it("sửa đơn đã giao → OrderLockedError, dữ liệu không đổi", async () => {
    const order = await createWithStatus("DELIVERED");

    await expect(updateOrder(order.id, { ...input, quantity: 99 })).rejects.toBeInstanceOf(
      OrderLockedError,
    );

    const after = await getOrder(order.id);
    expect(after.quantity).toBe(input.quantity);
    expect(after.amount).toBe(order.amount);
  });

  it("input không hợp lệ → ZodError", async () => {
    const order = await createOrder(input);
    await expect(updateOrder(order.id, { ...input, quantity: 0 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("deleteOrder", () => {
  it("xóa được đơn NEW", async () => {
    const order = await createOrder(input);
    await deleteOrder(order.id);
    expect(await prisma.order.count()).toBe(0);
  });

  it.each(["DELIVERED", "CANCELLED"] as const)("không xóa được đơn %s", async (status) => {
    const order = await createWithStatus(status);
    await expect(deleteOrder(order.id)).rejects.toBeInstanceOf(OrderLockedError);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe("id không tồn tại → NotFoundError", () => {
  const missing = "khong-ton-tai";

  it("getOrder", async () => {
    await expect(getOrder(missing)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updateOrder", async () => {
    await expect(updateOrder(missing, input)).rejects.toBeInstanceOf(NotFoundError);
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
    const first = await createOrder(input);
    const second = await createOrder(input);
    await createWithStatus("DELIVERED");

    const result = await listOrders({ status: "NEW" });
    expect(result.map((o) => o.id)).toEqual([second.id, first.id]);
  });

  it("status lạ → ZodError", async () => {
    await expect(listOrders({ status: "FOO" })).rejects.toBeInstanceOf(ZodError);
  });
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
