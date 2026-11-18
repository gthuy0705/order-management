"use client";

import { useActionState, type MouseEvent } from "react";
import type { ActionState } from "../actions";

type Props = {
  changeStatus: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  remove: (prev: ActionState) => Promise<ActionState>;
};

function confirmOrCancel(message: string) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function OrderActions({ changeStatus, remove }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(changeStatus, { attempt: 0 });
  const [deleteState, deleteAction, deletePending] = useActionState(remove, { attempt: 0 });
  const pending = statusPending || deletePending;
  const error = statusState.error ?? deleteState.error;

  return (
    <>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <form action={statusAction}>
          <button type="submit" name="status" value="DELIVERED" disabled={pending}>
            Đánh dấu đã giao
          </button>
        </form>
        <form action={statusAction}>
          <button
            type="submit"
            name="status"
            value="CANCELLED"
            className="secondary"
            disabled={pending}
            onClick={confirmOrCancel("Hủy đơn này? Đơn đã hủy không thể sửa hay khôi phục.")}
          >
            Hủy đơn
          </button>
        </form>
        <form action={deleteAction}>
          <button
            type="submit"
            className="danger"
            disabled={pending}
            onClick={confirmOrCancel("Xóa vĩnh viễn đơn này?")}
          >
            Xóa
          </button>
        </form>
      </div>
    </>
  );
}
