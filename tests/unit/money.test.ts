import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calcAmount } from "@/lib/orders/money";

describe("calcAmount", () => {
  it("nhân số lượng với đơn giá", () => {
    expect(calcAmount(3, new Prisma.Decimal("50000")).toFixed(2)).toBe("150000.00");
  });

  it("không có sai số float với số thập phân", () => {
    // 0.1 * 3 in float is 0.30000000000000004
    expect(calcAmount(3, new Prisma.Decimal("0.1")).toFixed(2)).toBe("0.30");
  });

  it("giữ chính xác với số lớn", () => {
    const amount = calcAmount(1_000_000, new Prisma.Decimal("999999999.99"));
    expect(amount.toFixed(2)).toBe("999999999990000.00");
  });
});
