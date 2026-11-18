import type { OrderStatus } from "@prisma/client";
import { STATUS_LABELS } from "./labels";

// Base class so lib/http.ts can tell expected business errors apart from bugs.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor() {
    super("Không tìm thấy đơn hàng.");
  }
}

export class ConflictError extends DomainError {
  constructor() {
    super("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang.");
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Không thể chuyển trạng thái từ "${STATUS_LABELS[from]}" sang "${STATUS_LABELS[to]}".`,
    );
  }
}

export class OrderLockedError extends DomainError {
  constructor(status: OrderStatus) {
    super(`Đơn đã chốt (${STATUS_LABELS[status]}), không thể sửa, đổi trạng thái hoặc xóa.`);
  }
}
