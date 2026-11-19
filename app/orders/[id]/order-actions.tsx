"use client";

import { useActionState, type MouseEvent } from "react";
import type { ActionState } from "../actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  changeStatus: Action;
  remove: Action;
  /** The version shown on screen: acting on a stale page is refused (409). */
  version: number;
};

function confirmOrCancel(message: string) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function OrderActions({ changeStatus, remove, version }: Props) {
  const [statusState, statusAction, statusPending] = useActionState(changeStatus, { attempt: 0 });
  const [deleteState, deleteAction, deletePending] = useActionState(remove, { attempt: 0 });
  const pending = statusPending || deletePending;
  const error = statusState.error ?? deleteState.error;

  return (
    <div className="actions">
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <form action={statusAction}>
        <input type="hidden" name="version" value={version} />
        <button type="submit" name="status" value="DELIVERED" className="btn btn--secondary" disabled={pending}>
          Đánh dấu đã giao
        </button>
      </form>
      <form action={statusAction}>
        <input type="hidden" name="version" value={version} />
        <button
          type="submit"
          name="status"
          value="CANCELLED"
          className="btn btn--secondary"
          disabled={pending}
          onClick={confirmOrCancel("Hủy đơn này? Đơn đã hủy không thể sửa hay khôi phục.")}
        >
          Hủy đơn
        </button>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="version" value={version} />
        <button
          type="submit"
          className="btn btn--danger"
          disabled={pending}
          onClick={confirmOrCancel("Xóa đơn này? Đơn sẽ bị ẩn khỏi danh sách (lịch sử vẫn được lưu).")}
        >
          Xóa
        </button>
      </form>
    </div>
  );
}
