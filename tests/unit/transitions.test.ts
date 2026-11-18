import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { canTransition, isFinal } from "@/lib/orders/transitions";

const ALL: OrderStatus[] = ["NEW", "DELIVERED", "CANCELLED"];
const ALLOWED = new Set(["NEW->DELIVERED", "NEW->CANCELLED"]);

describe("canTransition", () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const expected = ALLOWED.has(`${from}->${to}`);
      it(`${from} → ${to} ${expected ? "hợp lệ" : "không hợp lệ"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("isFinal", () => {
  it("chỉ DELIVERED và CANCELLED là trạng thái đã chốt", () => {
    expect(isFinal("NEW")).toBe(false);
    expect(isFinal("DELIVERED")).toBe(true);
    expect(isFinal("CANCELLED")).toBe(true);
  });
});
