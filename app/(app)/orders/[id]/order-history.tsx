import { formatMoney, formatVnDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderEventDTO } from "@/lib/orders/service";

const FIELD_LABELS: Record<string, string> = {
  customerName: "Khách hàng",
  productName: "Mặt hàng",
  quantity: "Số lượng",
  unitPrice: "Đơn giá",
  amount: "Thành tiền",
};

const MONEY_FIELDS = new Set(["unitPrice", "amount"]);

function formatValue(field: string, value: unknown): string {
  const text = String(value);
  return MONEY_FIELDS.has(field) ? formatMoney(text) : text;
}

type FieldChange = { from: unknown; to: unknown };

function isChange(value: unknown): value is FieldChange {
  return typeof value === "object" && value !== null && "from" in value && "to" in value;
}

function statusLabel(status: OrderEventDTO["fromStatus"]): string {
  return status ? STATUS_LABELS[status] : "?";
}

function describe(event: OrderEventDTO): { title: string; details: string[] } {
  switch (event.type) {
    case "CREATED":
      return { title: "Tạo đơn", details: [] };
    case "UPDATED": {
      const details: string[] = [];
      for (const [field, change] of Object.entries(event.changes ?? {})) {
        if (!isChange(change)) continue;
        const label = FIELD_LABELS[field] ?? field;
        details.push(`${label}: ${formatValue(field, change.from)} → ${formatValue(field, change.to)}`);
      }
      return { title: "Sửa đơn", details };
    }
    case "STATUS_CHANGED":
      return {
        title: `Đổi trạng thái: ${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`,
        details: [],
      };
    case "DELETED":
      return { title: "Xóa đơn", details: [] };
  }
}

export function OrderHistory({ events }: { events: OrderEventDTO[] }) {
  if (events.length === 0) return <p className="muted">Chưa có thay đổi nào được ghi lại.</p>;
  return (
    <ol className="timeline">
      {events.map((event) => {
        const { title, details } = describe(event);
        return (
          <li key={event.id} className="timeline__item">
            <p className="timeline__title">{title}</p>
            {details.length > 0 && (
              <ul className="timeline__details">
                {details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="timeline__meta muted">
              {event.actor.name} · {formatVnDateTime(event.createdAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
