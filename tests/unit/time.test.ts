import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetweenInclusive,
  isValidDay,
  VN_OFFSET_MINUTES,
  vnDayStartUtc,
  vnToday,
} from "@/lib/time";

describe("VN_OFFSET_MINUTES", () => {
  it("Việt Nam là UTC+7", () => {
    expect(VN_OFFSET_MINUTES).toBe(420);
  });
});

describe("vnDayStartUtc", () => {
  it("00:00 giờ VN = 17:00 UTC ngày hôm trước", () => {
    expect(vnDayStartUtc("2026-11-18").toISOString()).toBe("2026-11-17T17:00:00.000Z");
  });

  it("đúng qua ranh giới năm", () => {
    expect(vnDayStartUtc("2026-01-01").toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });

  it("ném lỗi với ngày không hợp lệ", () => {
    expect(() => vnDayStartUtc("2026-02-30")).toThrow();
  });
});

describe("vnToday", () => {
  it("16:59:59 UTC vẫn là ngày hôm đó ở VN", () => {
    expect(vnToday(new Date("2026-11-17T16:59:59Z"))).toBe("2026-11-17");
  });

  it("17:00 UTC đã sang ngày hôm sau ở VN", () => {
    expect(vnToday(new Date("2026-11-17T17:00:00Z"))).toBe("2026-11-18");
  });
});

describe("isValidDay", () => {
  it.each(["2026-11-18", "2024-02-29", "2026-12-31"])("chấp nhận %s", (day) => {
    expect(isValidDay(day)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-1", "18/11/2026", "", "2026-11-18T00:00"])(
    "từ chối %j",
    (day) => {
      expect(isValidDay(day)).toBe(false);
    },
  );
});

describe("addDays", () => {
  it("cộng qua cuối tháng và cuối năm", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("trừ ngày với n âm", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-18", -29)).toBe("2026-10-20");
  });
});

describe("daysBetweenInclusive", () => {
  it("đếm cả hai đầu", () => {
    expect(daysBetweenInclusive("2026-11-18", "2026-11-18")).toBe(1);
    expect(daysBetweenInclusive("2026-01-01", "2026-12-31")).toBe(365);
    expect(daysBetweenInclusive("2024-01-01", "2024-12-31")).toBe(366);
  });
});
