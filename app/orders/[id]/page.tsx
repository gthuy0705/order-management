import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatMoney, formatVnDateTime } from "@/lib/format";
import { NotFoundError } from "@/lib/orders/errors";
import { getOrder, type OrderDTO } from "@/lib/orders/service";
import { changeStatusAction, deleteOrderAction, updateOrderAction } from "../actions";
import { OrderForm } from "../order-form";
import { StatusBadge } from "../status-badge";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

async function loadOrder(id: string): Promise<OrderDTO> {
  try {
    return await getOrder(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <>
      <p>
        <Link href="/orders">← Danh sách đơn hàng</Link>
      </p>
      <Suspense fallback={<p className="muted">Đang tải…</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/orders/[id]">, "params">) {
  const { id } = await params;
  const order = await loadOrder(id);
  const editable = order.status === "NEW";

  return (
    <>
      <h1>
        Đơn {order.id.slice(-8)} <StatusBadge status={order.status} />
      </h1>
      <dl className="details">
        <dt>Mã đầy đủ</dt>
        <dd>{order.id}</dd>
        <dt>Ngày tạo</dt>
        <dd>{formatVnDateTime(order.createdAt)}</dd>
        <dt>Cập nhật lần cuối</dt>
        <dd>{formatVnDateTime(order.updatedAt)}</dd>
      </dl>

      {editable ? (
        <>
          <OrderForm
            action={updateOrderAction.bind(null, order.id)}
            initialValues={{
              customerName: order.customerName,
              productName: order.productName,
              quantity: String(order.quantity),
              unitPrice: order.unitPrice,
            }}
            submitLabel="Lưu thay đổi"
            successMessage="Đã lưu thay đổi."
          />
          <OrderActions
            changeStatus={changeStatusAction.bind(null, order.id)}
            remove={deleteOrderAction.bind(null, order.id)}
          />
        </>
      ) : (
        <>
          <p className="notice">Đơn đã chốt, không thể chỉnh sửa.</p>
          <dl className="details">
            <dt>Khách hàng</dt>
            <dd>{order.customerName}</dd>
            <dt>Mặt hàng</dt>
            <dd>{order.productName}</dd>
            <dt>Số lượng</dt>
            <dd>{order.quantity}</dd>
            <dt>Đơn giá</dt>
            <dd>{formatMoney(order.unitPrice)}</dd>
            <dt>Thành tiền</dt>
            <dd>
              <strong>{formatMoney(order.amount)}</strong>
            </dd>
          </dl>
        </>
      )}
    </>
  );
}
