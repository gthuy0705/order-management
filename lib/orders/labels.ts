import type { OrderStatus } from "@prisma/client";

// Type-only import: safe to use from client components.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Mới",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};
