import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  decodeCursor,
  encodeCursor,
  idempotencyKeySchema,
  listFilterSchema,
  orderInputSchema,
  orderUpdateSchema,
  statusChangeSchema,
} from "@/lib/orders/schema";

const valid = {
  customerName: "Nguyễn Văn A",
  productName: "Bút bi",
  quantity: 3,
  unitPrice: "5000",
};

function fieldErrorsOf(input: unknown): Record<string, unknown> {
  const result = orderInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return {};
  return z.flattenError(result.error).fieldErrors;
}

describe("orderInputSchema", () => {
  it("chấp nhận input hợp lệ và trim chuỗi", () => {
    const data = orderInputSchema.parse({ ...valid, customerName: "  An  " });
    expect(data).toEqual({ ...valid, customerName: "An" });
  });

  it("nhận quantity và unitPrice dạng string từ form", () => {
    const data = orderInputSchema.parse({ ...valid, quantity: "4", unitPrice: "12.5" });
    expect(data.quantity).toBe(4);
    expect(data.unitPrice).toBe("12.5");
  });

  it("chuẩn hóa unitPrice dạng number thành string", () => {
    expect(orderInputSchema.parse({ ...valid, unitPrice: 150000 }).unitPrice).toBe("150000");
  });

  it.each([0, -1, 1.5, "", "abc", 2_147_483_648])("từ chối quantity = %j", (quantity) => {
    expect(fieldErrorsOf({ ...valid, quantity })).toHaveProperty("quantity");
  });

  it.each([0, "0", "0.00", -5, "-5", "", "1.234", "abc", "1e5"])(
    "từ chối unitPrice = %j",
    (unitPrice) => {
      expect(fieldErrorsOf({ ...valid, unitPrice })).toHaveProperty("unitPrice");
    },
  );

  it.each(["customerName", "productName"])("từ chối %s rỗng hoặc chỉ có khoảng trắng", (field) => {
    expect(fieldErrorsOf({ ...valid, [field]: "   " })).toHaveProperty(field);
  });

  it("từ chối tên dài quá 200 ký tự", () => {
    expect(fieldErrorsOf({ ...valid, productName: "x".repeat(201) })).toHaveProperty("productName");
  });

  it("từ chối khi thành tiền vượt quá Decimal(18,2)", () => {
    const errors = fieldErrorsOf({ ...valid, quantity: 10, unitPrice: "1000000000000000" });
    expect(errors).toHaveProperty("unitPrice");
  });

  it("quantity sai chỉ báo lỗi ở quantity, không báo lỗi giả ở unitPrice", () => {
    expect(Object.keys(fieldErrorsOf({ ...valid, quantity: "abc" }))).toEqual(["quantity"]);
  });

  it("bỏ các field client không được gửi (amount, status, id, createdAt)", () => {
    const data = orderInputSchema.parse({
      ...valid,
      amount: "1",
      status: "DELIVERED",
      id: "hack",
      createdAt: "2000-01-01",
    });
    expect(data).toEqual(valid);
  });
});

describe("statusChangeSchema", () => {
  it.each(["DELIVERED", "CANCELLED"])("chấp nhận %s", (status) => {
    expect(statusChangeSchema.parse({ status })).toEqual({ status });
  });

  it.each(["NEW", "delivered", "", undefined])("từ chối %j", (status) => {
    expect(statusChangeSchema.safeParse({ status }).success).toBe(false);
  });
});

describe("orderUpdateSchema", () => {
  it("bắt buộc version, nhận cả string từ form", () => {
    expect(orderUpdateSchema.parse({ ...valid, version: "3" }).version).toBe(3);
    expect(orderUpdateSchema.safeParse(valid).success).toBe(false);
  });

  it.each([0, -1, 1.5, "abc"])("từ chối version = %j", (version) => {
    expect(orderUpdateSchema.safeParse({ ...valid, version }).success).toBe(false);
  });

  it("vẫn kiểm tra giới hạn thành tiền như khi tạo", () => {
    const result = orderUpdateSchema.safeParse({
      ...valid,
      quantity: 10,
      unitPrice: "1000000000000000",
      version: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("listFilterSchema", () => {
  it("mặc định 20 dòng mỗi trang, status và cursor không bắt buộc", () => {
    expect(listFilterSchema.parse({})).toEqual({ limit: 20 });
  });

  it("nhận limit dạng string từ query", () => {
    expect(listFilterSchema.parse({ limit: "50" }).limit).toBe(50);
  });

  it.each([{ status: "FOO" }, { limit: 0 }, { limit: 101 }, { limit: "x" }, { cursor: "rác" }])(
    "từ chối %j",
    (filter) => {
      expect(listFilterSchema.safeParse(filter).success).toBe(false);
    },
  );

  it("giải mã cursor hợp lệ", () => {
    const cursor = encodeCursor({ createdAt: new Date("2026-11-18T03:00:00.000Z"), id: "abc" });
    expect(listFilterSchema.parse({ cursor }).cursor).toEqual({
      createdAt: new Date("2026-11-18T03:00:00.000Z"),
      id: "abc",
    });
  });
});

describe("cursor", () => {
  it("encode → decode giữ nguyên giá trị", () => {
    const value = { createdAt: new Date("2026-01-02T03:04:05.678Z"), id: "cm123" };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it.each(["", "abc", Buffer.from("not-a-date|id").toString("base64url"), Buffer.from("2026-01-01T00:00:00.000Z|").toString("base64url")])(
    "trả null với %j",
    (value) => {
      expect(decodeCursor(value)).toBeNull();
    },
  );
});

describe("idempotencyKeySchema", () => {
  it.each(["", "short", "x".repeat(101)])("từ chối %j", (key) => {
    expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
  });

  it("chấp nhận UUID", () => {
    expect(idempotencyKeySchema.parse("3f2c6a40-6f0e-4b1a-9a53-2a1f0e4b8c11")).toHaveLength(36);
  });
});
