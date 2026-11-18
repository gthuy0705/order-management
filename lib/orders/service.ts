import {
  Prisma,
  type Order,
  type OrderEvent,
  type OrderEventType,
  type OrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  OrderLockedError,
} from "./errors";
import { calcAmount } from "./money";
import {
  deleteOptionsSchema,
  encodeCursor,
  idempotencyKeySchema,
  listFilterSchema,
  orderInputSchema,
  orderUpdateSchema,
  statusChangeSchema,
} from "./schema";
import { canTransition, isFinal } from "./transitions";

// Who performs a write; recorded in the audit trail.
export type Actor = { id: string };

// Shape sent to clients: money as string (no float rounding), dates as ISO.
export type OrderDTO = {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  status: OrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export function toOrderDTO(order: Order): OrderDTO {
  return {
    id: order.id,
    customerName: order.customerName,
    productName: order.productName,
    quantity: order.quantity,
    unitPrice: order.unitPrice.toFixed(2),
    amount: order.amount.toFixed(2),
    status: order.status,
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

type Tx = Prisma.TransactionClient;

// Soft-deleted orders are invisible everywhere except the audit trail.
const ACTIVE = { deletedAt: null } as const;

// The editable fields, money already as Decimal and amount derived on the server.
type WriteData = {
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
};

function toWriteData(data: { customerName: string; productName: string; quantity: number; unitPrice: string }): WriteData {
  const unitPrice = new Prisma.Decimal(data.unitPrice);
  return {
    customerName: data.customerName,
    productName: data.productName,
    quantity: data.quantity,
    unitPrice,
    amount: calcAmount(data.quantity, unitPrice),
  };
}

// JSON-friendly view of the editable fields, as stored in the audit trail.
function auditFields(data: WriteData | Order): Record<keyof WriteData, string | number> {
  return {
    customerName: data.customerName,
    productName: data.productName,
    quantity: data.quantity,
    unitPrice: data.unitPrice.toFixed(2),
    amount: data.amount.toFixed(2),
  };
}

type FieldChange = { from: string | number; to: string | number };

function diffFields(before: Order, after: WriteData): Record<string, FieldChange> {
  const old = auditFields(before);
  const next = auditFields(after);
  const changes: Record<string, FieldChange> = {};
  for (const key of Object.keys(next) as (keyof WriteData)[]) {
    if (old[key] !== next[key]) changes[key] = { from: old[key], to: next[key] };
  }
  return changes;
}

async function recordEvent(
  tx: Tx,
  actor: Actor,
  orderId: string,
  type: OrderEventType,
  details: { fromStatus?: OrderStatus; toStatus?: OrderStatus; changes?: Prisma.InputJsonValue } = {},
): Promise<void> {
  await tx.orderEvent.create({ data: { orderId, type, actorId: actor.id, ...details } });
}

// Reads the order inside the transaction and enforces the common rules for
// any write: it exists, it is not finalised, and (if the caller says which
// version it saw) nobody has changed it since.
async function loadForWrite(tx: Tx, id: string, expectedVersion?: number): Promise<Order> {
  const order = await tx.order.findFirst({ where: { id, ...ACTIVE } });
  if (!order) throw new NotFoundError();
  if (isFinal(order.status)) throw new OrderLockedError(order.status);
  if (expectedVersion !== undefined && order.version !== expectedVersion) {
    throw new ConflictError();
  }
  return order;
}

// The write is conditional on the exact state just read (status + version).
// Postgres re-checks the WHERE after waiting for a concurrent writer's row
// lock, so if another request committed in between, count is 0 → conflict.
async function conditionalUpdate(tx: Tx, current: Order, data: Prisma.OrderUpdateManyMutationInput) {
  const { count } = await tx.order.updateMany({
    where: { id: current.id, status: current.status, version: current.version, ...ACTIVE },
    data: { ...data, version: { increment: 1 } },
  });
  if (count === 0) throw new ConflictError();
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type CreateOrderResult = { order: OrderDTO; replayed: boolean };

// With an idempotency key, retrying the same request (e.g. after a network
// timeout) returns the order created the first time instead of a duplicate.
export async function createOrder(
  actor: Actor,
  input: unknown,
  options: { idempotencyKey?: string | null } = {},
): Promise<CreateOrderResult> {
  const data = toWriteData(orderInputSchema.parse(input));
  const idempotencyKey =
    options.idempotencyKey == null ? undefined : idempotencyKeySchema.parse(options.idempotencyKey);

  const replay = async () => {
    if (!idempotencyKey) return null;
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    return existing && { order: toOrderDTO(existing), replayed: true };
  };

  const earlier = await replay();
  if (earlier) return earlier;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({ data: { ...data, status: "NEW", idempotencyKey } });
      await recordEvent(tx, actor, created.id, "CREATED", {
        toStatus: "NEW",
        changes: auditFields(created),
      });
      return created;
    });
    return { order: toOrderDTO(order), replayed: false };
  } catch (error) {
    // Two requests with the same key passed the lookup at the same time; the
    // unique index let only one insert through, so return that one.
    if (idempotencyKey && isUniqueViolation(error)) {
      const winner = await replay();
      if (winner) return winner;
    }
    throw error;
  }
}

export async function getOrder(id: string): Promise<OrderDTO> {
  const order = await prisma.order.findFirst({ where: { id, ...ACTIVE } });
  if (!order) throw new NotFoundError();
  return toOrderDTO(order);
}

export type OrderPage = { items: OrderDTO[]; nextCursor: string | null };

// Keyset pagination on (createdAt desc, id desc): stable while new orders
// arrive and as fast on page 1000 as on page 1 (no OFFSET scan).
export async function listOrders(filter: unknown = {}): Promise<OrderPage> {
  const { status, cursor, limit } = listFilterSchema.parse(filter);
  const rows = await prisma.order.findMany({
    where: {
      ...ACTIVE,
      status,
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // One extra row tells whether another page exists.
    take: limit + 1,
  });
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(toOrderDTO),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}

export async function updateOrder(actor: Actor, id: string, input: unknown): Promise<OrderDTO> {
  const { version, ...fields } = orderUpdateSchema.parse(input);
  const data = toWriteData(fields);

  return prisma.$transaction(async (tx) => {
    const current = await loadForWrite(tx, id, version);
    const changes = diffFields(current, data);
    // Saving an unchanged form is not an edit: no version bump, no event.
    if (Object.keys(changes).length === 0) return toOrderDTO(current);

    await conditionalUpdate(tx, current, data);
    await recordEvent(tx, actor, id, "UPDATED", { changes });
    return toOrderDTO(await tx.order.findUniqueOrThrow({ where: { id } }));
  });
}

export async function changeStatus(actor: Actor, id: string, input: unknown): Promise<OrderDTO> {
  const { status: to, version } = statusChangeSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const current = await loadForWrite(tx, id, version);
    if (!canTransition(current.status, to)) throw new InvalidTransitionError(current.status, to);

    await conditionalUpdate(tx, current, { status: to });
    await recordEvent(tx, actor, id, "STATUS_CHANGED", { fromStatus: current.status, toStatus: to });
    return toOrderDTO(await tx.order.findUniqueOrThrow({ where: { id } }));
  });
}

// Soft delete: only NEW orders, and the audit trail keeps the record.
export async function deleteOrder(actor: Actor, id: string, options: unknown = {}): Promise<void> {
  const { version } = deleteOptionsSchema.parse(options);

  await prisma.$transaction(async (tx) => {
    const current = await loadForWrite(tx, id, version);
    await conditionalUpdate(tx, current, { deletedAt: new Date() });
    await recordEvent(tx, actor, id, "DELETED", { fromStatus: current.status });
  });
}

export type OrderEventDTO = {
  id: string;
  type: OrderEventType;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  changes: Record<string, unknown> | null;
  actor: { id: string; name: string };
  createdAt: string;
};

function toEventDTO(event: OrderEvent & { actor: { id: string; name: string } }): OrderEventDTO {
  const changes = event.changes;
  return {
    id: event.id,
    type: event.type,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    changes:
      changes && typeof changes === "object" && !Array.isArray(changes)
        ? (changes as Record<string, unknown>)
        : null,
    actor: event.actor,
    createdAt: event.createdAt.toISOString(),
  };
}

// Oldest first: reads as the story of the order.
export async function getOrderHistory(id: string): Promise<OrderEventDTO[]> {
  await getOrder(id); // 404 for unknown or deleted orders
  const events = await prisma.orderEvent.findMany({
    where: { orderId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actor: { select: { id: true, name: true } } },
  });
  return events.map(toEventDTO);
}
