import { Prisma, type Order, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  OrderLockedError,
} from "./errors";
import { calcAmount } from "./money";
import { listFilterSchema, orderInputSchema, statusChangeSchema } from "./schema";
import { canTransition, isFinal } from "./transitions";

// Shape sent to clients: money as string (no float rounding), dates as ISO.
export type OrderDTO = {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  status: OrderStatus;
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
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

// Parses untrusted input and derives amount on the server.
function toWriteData(input: unknown) {
  const data = orderInputSchema.parse(input);
  const unitPrice = new Prisma.Decimal(data.unitPrice);
  return {
    customerName: data.customerName,
    productName: data.productName,
    quantity: data.quantity,
    unitPrice,
    amount: calcAmount(data.quantity, unitPrice),
  };
}

// Called after a conditional write matched nothing, to tell the caller why.
async function lockedOrNotFound(id: string): Promise<never> {
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new NotFoundError();
  throw new OrderLockedError(order.status);
}

export async function createOrder(input: unknown): Promise<OrderDTO> {
  const order = await prisma.order.create({
    data: { ...toWriteData(input), status: "NEW" },
  });
  return toOrderDTO(order);
}

export async function getOrder(id: string): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError();
  return toOrderDTO(order);
}

export async function listOrders(filter: unknown = {}): Promise<OrderDTO[]> {
  const { status } = listFilterSchema.parse(filter);
  const orders = await prisma.order.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
  return orders.map(toOrderDTO);
}

export async function updateOrder(id: string, input: unknown): Promise<OrderDTO> {
  const data = toWriteData(input);
  // The status condition is checked by Postgres in the same statement as the
  // write, so a concurrent "deliver" cannot slip in between a read and a write.
  const { count } = await prisma.order.updateMany({
    where: { id, status: "NEW" },
    data,
  });
  if (count === 0) await lockedOrNotFound(id);
  return getOrder(id);
}

export async function changeStatus(id: string, input: unknown): Promise<OrderDTO> {
  const { status: to } = statusChangeSchema.parse(input);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError();
  if (isFinal(order.status)) throw new OrderLockedError(order.status);
  if (!canTransition(order.status, to)) throw new InvalidTransitionError(order.status, to);

  // Only succeeds if the status is still what we just read; if another request
  // changed it in the meantime, count is 0 and we report a conflict.
  const { count } = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: { status: to },
  });
  if (count === 0) throw new ConflictError();
  return getOrder(id);
}

export async function deleteOrder(id: string): Promise<void> {
  const { count } = await prisma.order.deleteMany({ where: { id, status: "NEW" } });
  if (count === 0) await lockedOrNotFound(id);
}
