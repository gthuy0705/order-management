import type { Metadata } from "next";
import { createOrderAction } from "../actions";
import { OrderForm } from "../order-form";

export const metadata: Metadata = { title: "Tạo đơn" };

const EMPTY = { customerName: "", productName: "", quantity: "", unitPrice: "" };

export default function NewOrderPage() {
  return (
    <>
      <h1>Tạo đơn hàng</h1>
      <OrderForm action={createOrderAction} initialValues={EMPTY} submitLabel="Tạo đơn" />
    </>
  );
}
