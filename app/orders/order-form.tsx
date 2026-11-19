"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { ActionState, OrderFormValues } from "./actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  initialValues: OrderFormValues;
  submitLabel: string;
  successMessage?: string;
  /** Version of the order being edited; sent back for optimistic locking. */
  version?: number;
  /** Attach an idempotency key so a retried submit cannot create a duplicate. */
  idempotent?: boolean;
};

// 128 random bits as hex. getRandomValues also works on plain-http origins,
// where crypto.randomUUID is unavailable.
function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// One key per mounted form, created on the first submit (never during render,
// so it is not baked into server HTML shared by every visitor). Re-submitting
// after an error or a lost response reuses it; leaving the page and coming
// back mounts a new form with a new key.
function useIdempotentAction(action: Action, enabled: boolean): Action {
  const key = useRef<string | null>(null);
  return useCallback(
    (prev: ActionState, formData: FormData) => {
      if (enabled) {
        key.current ??= randomKey();
        formData.set("idempotencyKey", key.current);
      }
      return action(prev, formData);
    },
    [action, enabled],
  );
}

export function OrderForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
  version,
  idempotent = false,
}: Props) {
  const idempotentAction = useIdempotentAction(action, idempotent);
  const [state, formAction, pending] = useActionState(idempotentAction, { attempt: 0 });
  const succeeded = state.attempt > 0 && !state.error;

  return (
    <form action={formAction} className="form" noValidate>
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      {succeeded && successMessage && <p className="notice">{successMessage}</p>}
      {version !== undefined && <input type="hidden" name="version" value={version} />}
      {/* Remount after each submit so the fields show what the server echoed
          back (typed values on error, saved values on success). */}
      <OrderFields
        key={state.attempt}
        defaults={state.values ?? initialValues}
        fieldErrors={state.fieldErrors ?? {}}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? "Đang lưu…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

type FieldsProps = {
  defaults: OrderFormValues;
  fieldErrors: NonNullable<ActionState["fieldErrors"]>;
};

function OrderFields({ defaults, fieldErrors }: FieldsProps) {
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [unitPrice, setUnitPrice] = useState(defaults.unitPrice);

  return (
    <>
      <Field name="customerName" label="Khách hàng" defaultValue={defaults.customerName} errors={fieldErrors.customerName} />
      <Field name="productName" label="Mặt hàng" defaultValue={defaults.productName} errors={fieldErrors.productName} />
      <Field
        name="quantity"
        label="Số lượng"
        half
        inputMode="numeric"
        defaultValue={defaults.quantity}
        errors={fieldErrors.quantity}
        onChange={setQuantity}
      />
      <Field
        name="unitPrice"
        label="Đơn giá (₫)"
        half
        inputMode="decimal"
        defaultValue={defaults.unitPrice}
        errors={fieldErrors.unitPrice}
        onChange={setUnitPrice}
      />
      <p className="preview">
        <span className="preview__label">Thành tiền tạm tính</span>
        <strong className="preview__value">{previewAmount(quantity, unitPrice)}</strong>
        <small>Chỉ để tham khảo — server sẽ tự tính lại khi lưu.</small>
      </p>
    </>
  );
}

// Display-only estimate; float rounding is acceptable here because the server
// recomputes the real amount with Decimal.
function previewAmount(quantity: string, unitPrice: string): string {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (!quantity.trim() || !unitPrice.trim() || !(q > 0) || !(p > 0)) return "—";
  return formatMoney((q * p).toFixed(2));
}

type FieldProps = {
  name: keyof OrderFormValues;
  label: string;
  defaultValue: string;
  errors?: string[];
  /** Takes half a row next to another half field (one column on a phone). */
  half?: boolean;
  inputMode?: "numeric" | "decimal";
  onChange?: (value: string) => void;
};

function Field({ name, label, defaultValue, errors, half, inputMode, onChange }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className={half ? "field field--half" : "field"}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        onChange={onChange && ((event) => onChange(event.target.value))}
      />
      {errors && (
        <p id={errorId} className="field-error">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
