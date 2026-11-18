import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { changeStatus, createOrder } from "@/lib/orders/service";
import { revenueByDay } from "@/lib/reports/revenue";

type Status = "NEW" | "DELIVERED" | "CANCELLED";

// Creates an order through the service, then back-dates it. createdAt is
// server-controlled, so tests must set it directly to place orders on a day.
async function orderAt(createdAt: string, unitPrice: string, status: Status = "DELIVERED") {
  const order = await createOrder({
    customerName: "Khách",
    productName: "Hàng",
    quantity: 1,
    unitPrice,
  });
  if (status !== "NEW") await changeStatus(order.id, { status });
  await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(createdAt) } });
}

describe("revenueByDay", () => {
  it("chỉ tính đơn DELIVERED", async () => {
    await orderAt("2026-11-18T03:00:00Z", "100", "DELIVERED");
    await orderAt("2026-11-18T04:00:00Z", "200", "NEW");
    await orderAt("2026-11-18T05:00:00Z", "400", "CANCELLED");

    const report = await revenueByDay({ from: "2026-11-18", to: "2026-11-18" });

    expect(report.rows).toEqual([{ day: "2026-11-18", orders: 1, revenue: "100.00" }]);
  });

  it("00:30 giờ VN (17:30 UTC hôm trước) thuộc ngày VN hôm sau", async () => {
    await orderAt("2026-11-17T17:30:00Z", "100");

    const report = await revenueByDay({ from: "2026-11-17", to: "2026-11-18" });

    expect(report.rows).toEqual([{ day: "2026-11-18", orders: 1, revenue: "100.00" }]);
  });

  it("23:59:59 giờ VN (16:59:59 UTC) vẫn thuộc ngày VN đó", async () => {
    await orderAt("2026-11-17T16:59:59Z", "100");

    const report = await revenueByDay({ from: "2026-11-17", to: "2026-11-18" });

    expect(report.rows).toEqual([{ day: "2026-11-17", orders: 1, revenue: "100.00" }]);
  });

  it("lọc from/to bao gồm đúng cả hai biên", async () => {
    await orderAt("2026-11-14T16:59:59Z", "1"); // 14/11 23:59:59 VN — ngoài
    await orderAt("2026-11-14T17:00:00Z", "2"); // 15/11 00:00 VN — biên đầu
    await orderAt("2026-11-17T16:59:59Z", "4"); // 17/11 23:59:59 VN — biên cuối
    await orderAt("2026-11-17T17:00:00Z", "8"); // 18/11 00:00 VN — ngoài

    const report = await revenueByDay({ from: "2026-11-15", to: "2026-11-17" });

    expect(report.rows).toEqual([
      { day: "2026-11-15", orders: 1, revenue: "2.00" },
      { day: "2026-11-17", orders: 1, revenue: "4.00" },
    ]);
    expect(report.total).toEqual({ orders: 2, revenue: "6.00" });
  });

  it("cộng dồn và tổng chính xác với số thập phân", async () => {
    await orderAt("2026-11-16T03:00:00Z", "0.10");
    await orderAt("2026-11-16T04:00:00Z", "0.20");
    await orderAt("2026-11-17T03:00:00Z", "999999999999.99");

    const report = await revenueByDay({ from: "2026-11-16", to: "2026-11-17" });

    expect(report.rows).toEqual([
      { day: "2026-11-16", orders: 2, revenue: "0.30" },
      { day: "2026-11-17", orders: 1, revenue: "999999999999.99" },
    ]);
    expect(report.total).toEqual({ orders: 3, revenue: "1000000000000.29" });
  });

  it("không có đơn: không có dòng, tổng bằng 0", async () => {
    const report = await revenueByDay({ from: "2026-11-01", to: "2026-11-30" });
    expect(report.rows).toEqual([]);
    expect(report.total).toEqual({ orders: 0, revenue: "0.00" });
  });

  it("mặc định là 30 ngày gần nhất tính tới hôm nay (giờ VN)", async () => {
    const report = await revenueByDay({});
    expect(report.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (Date.parse(report.to) - Date.parse(report.from)) / 86_400_000 + 1;
    expect(days).toBe(30);
  });

  it.each([
    { from: "2026-11-18", to: "2026-11-17" },
    { from: "2025-01-01", to: "2026-01-02" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "18/11/2026", to: "2026-11-18" },
  ])("khoảng ngày không hợp lệ %j → ZodError", async (range) => {
    await expect(revenueByDay(range)).rejects.toBeInstanceOf(ZodError);
  });
});
