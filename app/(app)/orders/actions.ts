"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { DomainError } from "@/lib/orders/errors";
import { changeStatus, createOrder, deleteOrder, updateOrder } from "@/lib/orders/service";

// Thin layer like the route handlers: check the session → read the form →
// call the service → turn expected errors into state the form can display.
// Every action re-checks the session itself: Server Actions are public POST
// endpoints, and proxy.ts alone is not an authorisation check.

export type OrderFormValues = {
  customerName: string;
  productName: string;
  quantity: string;
  unitPrice: string;
};

export type ActionState = {
  // Incremented on every failed submit so the form can remount with the
  // values the user typed (React resets uncontrolled forms after an action).
  attempt: number;
  error?: string;
  fieldErrors?: Partial<Record<keyof OrderFormValues, string[]>>;
  values?: OrderFormValues;
};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readOrderForm(formData: FormData): OrderFormValues {
  return {
    customerName: readText(formData, "customerName"),
    productName: readText(formData, "productName"),
    quantity: readText(formData, "quantity"),
    unitPrice: readText(formData, "unitPrice"),
  };
}

// "" → undefined so an absent field is "not sent", not "invalid".
function readOptional(formData: FormData, name: string): string | undefined {
  return readText(formData, name) || undefined;
}

function failure(prev: ActionState, error: unknown, values?: OrderFormValues): ActionState {
  const attempt = prev.attempt + 1;
  if (error instanceof ZodError) {
    const { formErrors, fieldErrors } = z.flattenError(error);
    const extra = (fieldErrors as Record<string, string[] | undefined>).version;
    return {
      attempt,
      values,
      error: formErrors[0] ?? extra?.[0] ?? "Vui lòng kiểm tra lại các trường bị lỗi.",
      fieldErrors,
    };
  }
  if (error instanceof DomainError) {
    return { attempt, values, error: error.message };
  }
  // Unexpected errors go to app/error.tsx (and are logged by instrumentation.ts).
  throw error;
}

// Every page shows order data (list, detail, report), so refresh them all.
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createOrderAction(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const values = readOrderForm(formData);
  let id: string;
  try {
    const { order } = await createOrder(user, values, {
      idempotencyKey: readOptional(formData, "idempotencyKey"),
    });
    id = order.id;
  } catch (error) {
    return failure(prev, error, values);
  }
  revalidateAll();
  // redirect() works by throwing, so it must stay outside the try/catch.
  redirect(`/orders/${id}`);
}

export async function updateOrderAction(
  id: string,
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const values = readOrderForm(formData);
  try {
    await updateOrder(user, id, { ...values, version: readText(formData, "version") });
  } catch (error) {
    return failure(prev, error, values);
  }
  revalidateAll();
  return { attempt: prev.attempt + 1 };
}

export async function changeStatusAction(
  id: string,
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await changeStatus(user, id, {
      status: formData.get("status"),
      version: readOptional(formData, "version"),
    });
  } catch (error) {
    return failure(prev, error);
  }
  revalidateAll();
  return { attempt: prev.attempt + 1 };
}

export async function deleteOrderAction(
  id: string,
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await deleteOrder(user, id, { version: readOptional(formData, "version") });
  } catch (error) {
    return failure(prev, error);
  }
  revalidateAll();
  redirect("/orders");
}
