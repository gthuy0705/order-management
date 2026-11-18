import type { OrderStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/orders/labels";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
