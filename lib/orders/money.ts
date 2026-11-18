import { Prisma } from "@prisma/client";

// Matches the column type Decimal(18, 2): 16 digits before the decimal point.
export const MAX_AMOUNT = new Prisma.Decimal("9999999999999999.99");

export function calcAmount(quantity: number, unitPrice: Prisma.Decimal): Prisma.Decimal {
  return unitPrice.mul(quantity);
}
