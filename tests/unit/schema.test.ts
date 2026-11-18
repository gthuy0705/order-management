import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  listFilterSchema,
  orderInputSchema,
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

describe("listFilterSchema", () => {
  it("status không bắt buộc", () => {
    expect(listFilterSchema.parse({})).toEqual({});
  });

  it("từ chối status lạ", () => {
    expect(listFilterSchema.safeParse({ status: "FOO" }).success).toBe(false);
  });
});
