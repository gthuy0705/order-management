import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calcAmount, MAX_AMOUNT } from "./money";

// Postgres INTEGER upper bound; larger values would fail in the DB with a 500.
const MAX_INT = 2_147_483_647;

const nameSchema = (label: string) =>
  z
    .string({ error: `${label} là bắt buộc.` })
    .trim()
    .min(1, `${label} là bắt buộc.`)
    .max(200, `${label} tối đa 200 ký tự.`);

// Forms and query strings send strings, JSON clients may send numbers: accept
// both, then require a positive integer that fits a Postgres INTEGER.
function positiveIntSchema(message: string) {
  return z
    .union([z.number(), z.string().trim().regex(/^-?\d+(\.\d+)?$/).transform(Number)], {
      error: message,
    })
    .pipe(z.number().int(message).positive(message).max(MAX_INT, message));
}

const quantitySchema = positiveIntSchema("Số lượng phải là số nguyên lớn hơn 0.");

// Kept as a string end-to-end so the value reaches Prisma.Decimal without ever
// passing through a float.
const unitPriceSchema = z
  .union([z.string(), z.number()], { error: "Đơn giá là bắt buộc." })
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      // abort: Zod 4 keeps running later checks after a failure by default,
      // and the refine below would throw on a non-numeric string.
      .regex(/^\d+(\.\d{1,2})?$/, {
        message: "Đơn giá phải là số dương, tối đa 2 chữ số thập phân.",
        abort: true,
      })
      .refine((value) => new Prisma.Decimal(value).gt(0), "Đơn giá phải lớn hơn 0."),
  );

const versionSchema = positiveIntSchema("Thiếu hoặc sai phiên bản đơn (version).");

// z.object strips unknown keys by default, so amount/status/id/createdAt sent
// by the client never reach the service.
const orderFieldsSchema = z.object({
  customerName: nameSchema("Khách hàng"),
  productName: nameSchema("Mặt hàng"),
  quantity: quantitySchema,
  unitPrice: unitPriceSchema,
});

// Shared by create and update: the derived amount must fit Decimal(18, 2).
function amountFitsColumn(data: { quantity: number; unitPrice: string }): boolean {
  return calcAmount(data.quantity, new Prisma.Decimal(data.unitPrice)).lte(MAX_AMOUNT);
}
const AMOUNT_TOO_LARGE = { path: ["unitPrice"], message: "Thành tiền vượt quá giới hạn cho phép." };

export const orderInputSchema = orderFieldsSchema.refine(amountFitsColumn, AMOUNT_TOO_LARGE);

export type OrderInput = z.infer<typeof orderInputSchema>;

// An edit must say which version of the order it was made on (optimistic
// locking); without it two people editing at once would overwrite each other.
export const orderUpdateSchema = orderFieldsSchema
  .extend({ version: versionSchema })
  .refine(amountFitsColumn, AMOUNT_TOO_LARGE);

// version is optional here: the status buttons send it, but API clients that
// only care about the state machine may leave it out.
export const statusChangeSchema = z.object({
  status: z.enum(["DELIVERED", "CANCELLED"], {
    error: "Trạng thái mới chỉ có thể là DELIVERED hoặc CANCELLED.",
  }),
  version: versionSchema.optional(),
});

export const deleteOptionsSchema = z.object({ version: versionSchema.optional() });

// Opaque to clients: base64url("<createdAt ISO>|<id>") of the last row shown.
export type Cursor = { createdAt: Date; id: string };

export function encodeCursor({ createdAt, id }: Cursor): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  const [iso, id, ...rest] = Buffer.from(value, "base64url").toString("utf8").split("|");
  const createdAt = new Date(iso);
  if (!id || rest.length > 0 || Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) {
    return null;
  }
  return { createdAt, id };
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const listFilterSchema = z.object({
  status: z
    .enum(["NEW", "DELIVERED", "CANCELLED"], { error: "Trạng thái lọc không hợp lệ." })
    .optional(),
  cursor: z
    .string()
    .refine((value) => decodeCursor(value) !== null, "Con trỏ phân trang không hợp lệ.")
    .transform((value) => decodeCursor(value) as Cursor)
    .optional(),
  limit: positiveIntSchema(`Số dòng mỗi trang phải từ 1 đến ${MAX_PAGE_SIZE}.`)
    .pipe(z.number().max(MAX_PAGE_SIZE, `Số dòng mỗi trang phải từ 1 đến ${MAX_PAGE_SIZE}.`))
    .default(DEFAULT_PAGE_SIZE),
});

// Any client-generated unique string (a UUID is typical).
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key phải dài 8–100 ký tự.")
  .max(100, "Idempotency-Key phải dài 8–100 ký tự.");
