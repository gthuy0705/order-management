import type { Metadata } from "next";
import { createOrderAction } from "../actions";
import { OrderForm } from "../order-form";

export const metadata: Metadata = { title: "Tạo đơn" };

const EMPTY = { customerName: "", productName: "", quantity: "", unitPrice: "" };

export default function NewOrderPage() {
  return (
    <>
      <div className="page-head">
        <h1>Tạo đơn hàng</h1>
        <p className="muted">Đơn mới luôn ở trạng thái Mới; thành tiền do server tính.</p>
      </div>
      <div className="panel panel--pad panel--narrow">
        <OrderForm action={createOrderAction} initialValues={EMPTY} submitLabel="Tạo đơn" idempotent />
      </div>
    </>
  );
}
