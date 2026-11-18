import type { Metadata } from "next";
import Form from "next/form";
import { connection } from "next/server";
import { Suspense } from "react";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { formatDay, formatMoney } from "@/lib/format";
import { revenueByDay, type RevenueReport } from "@/lib/reports/revenue";

export const metadata: Metadata = { title: "Báo cáo doanh thu" };

type Result =
  | { ok: true; report: RevenueReport }
  | { ok: false; fieldErrors: { from?: string[]; to?: string[] } };

function firstValue(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  // An empty date input submits "", which means "use the default".
  return text || undefined;
}

async function loadReport(from?: string, to?: string): Promise<Result> {
  try {
    return { ok: true, report: await revenueByDay({ from, to }) };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, fieldErrors: z.flattenError(error).fieldErrors };
    throw error;
  }
}

export default function RevenuePage({ searchParams }: PageProps<"/reports/revenue">) {
  return (
    <>
      <div className="page-head">
        <h1>Báo cáo doanh thu theo ngày</h1>
        <p className="muted">Chỉ tính đơn đã giao, nhóm theo ngày tạo đơn (giờ Việt Nam).</p>
      </div>
      <Suspense fallback={<p className="muted">Đang tải…</p>}>
        <RevenueContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RevenueContent({
  searchParams,
}: Pick<PageProps<"/reports/revenue">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  // The default range depends on today's date, which must be read per request,
  // never baked into a prerendered shell.
  await connection();
  const from = firstValue(params.from);
  const to = firstValue(params.to);
  const result = await loadReport(from, to);
  // Show the resolved default range when the user did not pick one.
  const shownFrom = result.ok ? result.report.from : from;
  const shownTo = result.ok ? result.report.to : to;
  const errors = result.ok ? [] : [...(result.fieldErrors.from ?? []), ...(result.fieldErrors.to ?? [])];

  return (
    <div className="stack">
      <Form action="/reports/revenue" className="panel panel--pad inline-form">
        <div className="field">
          <label htmlFor="from">Từ ngày</label>
          <input id="from" name="from" type="date" defaultValue={shownFrom} />
        </div>
        <div className="field">
          <label htmlFor="to">Đến ngày</label>
          <input id="to" name="to" type="date" defaultValue={shownTo} />
        </div>
        <button type="submit" className="btn btn--primary">
          Xem báo cáo
        </button>
      </Form>

      {errors.length > 0 && (
        <p className="alert" role="alert">
          {errors[0]}
        </p>
      )}
      {result.ok && <RevenueTable report={result.report} />}
    </div>
  );
}

function RevenueTable({ report }: { report: RevenueReport }) {
  if (report.rows.length === 0) {
    return <p className="panel empty muted">Không có đơn đã giao trong khoảng thời gian này.</p>;
  }
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ngày</th>
            <th className="num">Số đơn</th>
            <th className="num">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.day}>
              <td>{formatDay(row.day)}</td>
              <td className="num muted">{row.orders}</td>
              <td className="num">{formatMoney(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Tổng cộng</td>
            <td className="num" data-testid="total-orders">
              {report.total.orders}
            </td>
            <td className="num" data-testid="total-revenue">
              {formatMoney(report.total.revenue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
