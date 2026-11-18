import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calcAmount, MAX_AMOUNT } from "./money";

// Postgres INTEGER upper bound; larger values would fail in the DB with a 500.
const MAX_QUANTITY = 2_147_483_647;

const nameSchema = (label: string) =>
  z
    .string({ error: `${label} là bắt buộc.` })
    .trim()
    .min(1, `${label} là bắt buộc.`)
    .max(200, `${label} tối đa 200 ký tự.`);

// Forms send strings, JSON clients may send numbers: accept both.
const quantitySchema = z
  .union([z.number(), z.string().trim().regex(/^-?\d+(\.\d+)?$/).transform(Number)], {
    error: "Số lượng phải là số nguyên lớn hơn 0.",
  })
  .pipe(
    z
      .number()
      .int("Số lượng phải là số nguyên lớn hơn 0.")
      .positive("Số lượng phải là số nguyên lớn hơn 0.")
      .max(MAX_QUANTITY, "Số lượng quá lớn."),
  );

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

// z.object strips unknown keys by default, so amount/status/id/createdAt sent
// by the client never reach the service.
export const orderInputSchema = z
  .object({
    customerName: nameSchema("Khách hàng"),
    productName: nameSchema("Mặt hàng"),
    quantity: quantitySchema,
    unitPrice: unitPriceSchema,
  })
  .refine(
    (data) => calcAmount(data.quantity, new Prisma.Decimal(data.unitPrice)).lte(MAX_AMOUNT),
    { path: ["unitPrice"], message: "Thành tiền vượt quá giới hạn cho phép." },
  );

export type OrderInput = z.infer<typeof orderInputSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(["DELIVERED", "CANCELLED"], {
    error: "Trạng thái mới chỉ có thể là DELIVERED hoặc CANCELLED.",
  }),
});

export const listFilterSchema = z.object({
  status: z
    .enum(["NEW", "DELIVERED", "CANCELLED"], { error: "Trạng thái lọc không hợp lệ." })
    .optional(),
});
