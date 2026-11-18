import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { addDays, daysBetweenInclusive, isValidDay, vnDayStartUtc, vnToday } from "@/lib/time";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

const daySchema = z.string().refine(isValidDay, "Ngày không hợp lệ (định dạng YYYY-MM-DD).");

// Both ends are Vietnam business days and inclusive. Missing ends default to
// the last 30 days, so the API and the page share one definition of "default".
export const revenueRangeSchema = z
  .object({ from: daySchema.optional(), to: daySchema.optional() })
  .transform(({ from, to }) => {
    const end = to ?? vnToday();
    return { from: from ?? addDays(end, -(DEFAULT_DAYS - 1)), to: end };
  })
  .refine((range) => range.from <= range.to, {
    path: ["to"],
    message: "“Đến ngày” phải sau hoặc bằng “Từ ngày”.",
  })
  .refine((range) => daysBetweenInclusive(range.from, range.to) <= MAX_DAYS, {
    path: ["to"],
    message: `Khoảng ngày tối đa ${MAX_DAYS} ngày.`,
  });

export type RevenueRow = { day: string; orders: number; revenue: string };

export type RevenueReport = {
  from: string;
  to: string;
  rows: RevenueRow[];
  total: { orders: number; revenue: string };
};

export async function revenueByDay(input: unknown): Promise<RevenueReport> {
  const { from, to } = revenueRangeSchema.parse(input);
  // Half-open UTC interval [start of `from`, start of the day after `to`) —
  // compares on the raw timestamptz column, so the (status, created_at) index
  // can be used.
  const fromUtc = vnDayStartUtc(from);
  const toUtcExclusive = vnDayStartUtc(addDays(to, 1));

  // SUM is cast to text so the exact decimal value never passes through a JS
  // number. Days without delivered orders produce no row. Only NEW orders can
  // be deleted, so deleted_at never hides a DELIVERED one today; the filter
  // keeps that true if the rule ever changes.
  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int     AS orders,
           SUM(amount)::text AS revenue
    FROM orders
    WHERE status = 'DELIVERED'
      AND deleted_at IS NULL
      AND created_at >= ${fromUtc} AND created_at < ${toUtcExclusive}
    GROUP BY 1
    ORDER BY 1
  `;

  let totalRevenue = new Prisma.Decimal(0);
  let totalOrders = 0;
  for (const row of rows) {
    totalRevenue = totalRevenue.add(row.revenue);
    totalOrders += row.orders;
  }

  return {
    from,
    to,
    rows,
    total: { orders: totalOrders, revenue: totalRevenue.toFixed(2) },
  };
}
