"use client";

import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { ActionState, OrderFormValues } from "./actions";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues: OrderFormValues;
  submitLabel: string;
  successMessage?: string;
};

export function OrderForm({ action, initialValues, submitLabel, successMessage }: Props) {
  const [state, formAction, pending] = useActionState(action, { attempt: 0 });
  const succeeded = state.attempt > 0 && !state.error;

  return (
    <form action={formAction} className="stack" noValidate>
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      {succeeded && successMessage && <p className="notice">{successMessage}</p>}
      {/* Remount after each submit so the fields show what the server echoed
          back (typed values on error, saved values on success). */}
      <OrderFields
        key={state.attempt}
        defaults={state.values ?? initialValues}
        fieldErrors={state.fieldErrors ?? {}}
      />
      <div>
        <button type="submit" disabled={pending}>
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
        inputMode="numeric"
        defaultValue={defaults.quantity}
        errors={fieldErrors.quantity}
        onChange={setQuantity}
      />
      <Field
        name="unitPrice"
        label="Đơn giá (₫)"
        inputMode="decimal"
        defaultValue={defaults.unitPrice}
        errors={fieldErrors.unitPrice}
        onChange={setUnitPrice}
      />
      <p className="preview">
        Thành tiền tạm tính: <strong>{previewAmount(quantity, unitPrice)}</strong>
        <br />
        <small className="muted">Chỉ để tham khảo — server sẽ tự tính lại khi lưu.</small>
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
  inputMode?: "numeric" | "decimal";
  onChange?: (value: string) => void;
};

function Field({ name, label, defaultValue, errors, inputMode, onChange }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
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
