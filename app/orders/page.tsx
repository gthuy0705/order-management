import type { OrderStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ZodError } from "zod";
import { formatMoney, formatVnDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import { listOrders, type OrderDTO } from "@/lib/orders/service";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Đơn hàng" };

const FILTERS: { status?: OrderStatus; label: string }[] = [
  { label: "Tất cả" },
  ...(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => ({
    status,
    label: STATUS_LABELS[status],
  })),
];

async function loadOrders(status: string | undefined): Promise<OrderDTO[] | null> {
  try {
    return await listOrders({ status });
  } catch (error) {
    if (error instanceof ZodError) return null; // unknown ?status= value
    throw error;
  }
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
  const { status } = await searchParams;
  const current = typeof status === "string" ? status : undefined;
  const orders = await loadOrders(current);

  return (
    <>
      <div className="toolbar">
        <nav className="filters" aria-label="Lọc theo trạng thái">
          {FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={filter.status ? `/orders?status=${filter.status}` : "/orders"}
              aria-current={filter.status === current ? "page" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        {orders !== null && <p className="muted">{orders.length} đơn</p>}
      </div>

      {orders === null ? (
        <p className="alert">Trạng thái lọc không hợp lệ.</p>
      ) : orders.length === 0 ? (
        <p className="panel empty muted">
          Chưa có đơn hàng nào.{" "}
          <Link href="/orders/new" className="link">
            Tạo đơn mới
          </Link>
        </p>
      ) : (
        <OrdersTable orders={orders} />
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
