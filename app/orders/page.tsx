import type { OrderStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ZodError } from "zod";
import { formatMoney, formatVnDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import { listOrders, type OrderDTO, type OrderPage } from "@/lib/orders/service";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Đơn hàng" };

const FILTERS: { status?: OrderStatus; label: string }[] = [
  { label: "Tất cả" },
  ...(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => ({
    status,
    label: STATUS_LABELS[status],
  })),
];

async function loadOrders(status?: string, cursor?: string): Promise<OrderPage | null> {
  try {
    return await listOrders({ status, cursor });
  } catch (error) {
    if (error instanceof ZodError) return null; // unknown ?status= or broken ?cursor=
    throw error;
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

function pageHref(status: string | undefined, cursor?: string): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (cursor) query.set("cursor", cursor);
  const text = query.toString();
  return text ? `/orders?${text}` : "/orders";
}

// The heading is the static App Shell; everything that depends on the URL
// (?status=) or the database streams in inside the Suspense boundary.
export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  return (
    <>
      <div className="page-head">
        <h1>Đơn hàng</h1>
      </div>
      <Suspense fallback={<p className="muted">Đang tải…</p>}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersContent({ searchParams }: Pick<PageProps<"/orders">, "searchParams">) {
  const params = await searchParams;
  const current = firstValue(params.status);
  const cursor = firstValue(params.cursor);
  const page = await loadOrders(current, cursor);

  return (
    <>
      <div className="toolbar">
        <nav className="filters" aria-label="Lọc theo trạng thái">
          {FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={pageHref(filter.status)}
              aria-current={filter.status === current ? "page" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        {page !== null && (
          <p className="muted">
            {cursor ? "Trang tiếp" : "Mới nhất"} · {page.items.length} đơn
          </p>
        )}
      </div>

      {page === null ? (
        <p className="alert">Bộ lọc hoặc trang không hợp lệ.</p>
      ) : page.items.length === 0 ? (
        <p className="panel empty muted">
          Chưa có đơn hàng nào.{" "}
          <Link href="/orders/new" className="link">
            Tạo đơn mới
          </Link>
        </p>
      ) : (
        <>
          <OrdersTable orders={page.items} />
          {/* Keyset pagination only moves forward; "first page" restarts it. */}
          {(cursor || page.nextCursor) && (
            <nav className="pager" aria-label="Phân trang">
              {cursor && (
                <Link href={pageHref(current)} className="btn btn--sm btn--secondary">
                  ← Trang đầu
                </Link>
              )}
              {page.nextCursor && (
                <Link href={pageHref(current, page.nextCursor)} className="btn btn--sm btn--secondary">
                  Trang sau →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}

function OrdersTable({ orders }: { orders: OrderDTO[] }) {
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Khách hàng</th>
            <th>Mặt hàng</th>
            <th className="num">SL</th>
            <th className="num">Đơn giá</th>
            <th className="num">Thành tiền</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link href={`/orders/${order.id}`} className="order-id link">
                  {order.id.slice(-8)}
                </Link>
              </td>
              <td>{order.customerName}</td>
              <td>{order.productName}</td>
              <td className="num">{order.quantity}</td>
              <td className="num">{formatMoney(order.unitPrice)}</td>
              <td className="num">{formatMoney(order.amount)}</td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td className="muted">{formatVnDateTime(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
