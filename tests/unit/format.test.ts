import { describe, expect, it } from "vitest";
import { formatDay, formatMoney, formatVnDateTime } from "@/lib/format";

describe("formatMoney", () => {
  it.each([
    ["150000.00", "150.000 ₫"],
    ["0.00", "0 ₫"],
    ["999.00", "999 ₫"],
    ["1000", "1.000 ₫"],
    ["3500.50", "3.500,50 ₫"],
    ["1000000000000.29", "1.000.000.000.000,29 ₫"],
    ["9999999999999999.99", "9.999.999.999.999.999,99 ₫"],
  ])("%s → %s", (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });
});

describe("formatVnDateTime", () => {
  it("hiển thị theo giờ Việt Nam", () => {
    expect(formatVnDateTime("2026-11-17T17:30:00.000Z")).toBe("18/11/2026 00:30");
    expect(formatVnDateTime("2026-11-17T16:59:59.000Z")).toBe("17/11/2026 23:59");
  });
});

describe("formatDay", () => {
  it("YYYY-MM-DD → DD/MM/YYYY", () => {
    expect(formatDay("2026-01-05")).toBe("05/01/2026");
  });
});
