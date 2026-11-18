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
      <Link href="/orders" className="back-link">
        ← Danh sách đơn hàng
      </Link>
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
      <div className="page-head">
        <div className="title-row">
          <h1>
            Đơn <span className="mono">{order.id.slice(-8)}</span>
          </h1>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="detail">
        <section className="panel panel--pad" aria-labelledby="order-heading">
          <h2 id="order-heading">Thông tin đơn</h2>
          {editable ? (
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
          ) : (
            <div className="stack">
              <p className="notice">Đơn đã chốt, không thể chỉnh sửa.</p>
              <dl className="details">
                <div>
                  <dt>Khách hàng</dt>
                  <dd>{order.customerName}</dd>
                </div>
                <div>
                  <dt>Mặt hàng</dt>
                  <dd>{order.productName}</dd>
                </div>
                <div>
                  <dt>Số lượng</dt>
                  <dd>{order.quantity}</dd>
                </div>
                <div>
                  <dt>Đơn giá</dt>
                  <dd>{formatMoney(order.unitPrice)}</dd>
                </div>
                <div>
                  <dt>Thành tiền</dt>
                  <dd className="total">{formatMoney(order.amount)}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <div className="detail__side">
          {editable && (
            <section className="panel panel--pad" aria-labelledby="status-heading">
              <h2 id="status-heading">Trạng thái</h2>
              <OrderActions
                changeStatus={changeStatusAction.bind(null, order.id)}
                remove={deleteOrderAction.bind(null, order.id)}
              />
            </section>
          )}
          <section className="panel panel--pad" aria-labelledby="meta-heading">
            <h2 id="meta-heading">Lịch sử</h2>
            <dl className="details">
              <div className="details__stack">
                <dt>Mã đầy đủ</dt>
                <dd className="mono">{order.id}</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{formatVnDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{formatVnDateTime(order.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
