import type { OrderStatus } from "@prisma/client";

// The allowed state machine as data: adding a transition is a one-line change
// here instead of hunting for if/else chains across the codebase.
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// A status with no outgoing transition is final: the order is locked for
// editing, status changes and deletion.
export function isFinal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
