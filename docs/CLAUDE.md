# CLAUDE.md — Order Management (bài test IT-ERP)

## Bối cảnh

App nhỏ quản lý đơn hàng cho bài test tại nhà (hạn 48h). Người chấm đánh giá:
1. Làm đúng yêu cầu, **nhất là phần kiểm tra ở server**.
2. Mã dễ đọc; README đủ để người khác chạy lại.
3. Có test tự động (điểm cộng).
4. Ở vòng phỏng vấn, tác giả phải **giải thích được mọi dòng code** và sửa được khi yêu cầu thay đổi.

=> Ưu tiên code đơn giản, tường minh, ít "magic". Không over-engineer. Không thêm tính năng ngoài đề.

## Yêu cầu nghiệp vụ (nguồn sự thật — không tự thay đổi)

1. **Đơn hàng** gồm: khách hàng, mặt hàng, số lượng, đơn giá, thành tiền. Mỗi đơn một mặt hàng.
2. **Thành tiền = số lượng × đơn giá**, do **server** tự tính. Số lượng và đơn giá phải **> 0**.
3. **Trạng thái:** đơn mới tạo luôn là `NEW` (Mới). Chỉ được chuyển `NEW → DELIVERED` (Đã giao) hoặc `NEW → CANCELLED` (Hủy). Đơn `DELIVERED`/`CANCELLED` **không được sửa, không được đổi trạng thái, không được xóa**.
4. **Báo cáo doanh thu theo ngày:** mỗi ngày một dòng gồm số đơn và tổng thành tiền; **chỉ tính đơn DELIVERED**; nhóm theo **ngày tạo đơn** (giờ Việt Nam).
5. **Giao diện** chỉ cần đủ dùng.

## Stack (KHÔNG thêm dependency ngoài danh sách nếu chưa hỏi người dùng)

- Next.js (App Router) + TypeScript `strict`
- PostgreSQL 16 qua `docker compose`
- Prisma (ORM + migration + seed)
- Zod (validate input)
- Vitest (unit + integration), Playwright (chỉ ở Phase 7)
- **Không** dùng: UI component library, CSS framework nặng, thư viện ngày giờ (dayjs/date-fns…), state management library, form library. Tự viết helper nhỏ khi cần.

## Cấu trúc thư mục

```
proxy.ts                  # gắn request id cho mọi request
instrumentation.ts        # kiểm tra env lúc khởi động; log lỗi có cấu trúc (onRequestError)
app/
  orders/                 # trang danh sách, tạo, chi tiết (+ lịch sử)
  reports/revenue/        # trang báo cáo
  api/orders/...          # route handlers (mỏng)
  api/reports/revenue/
  api/health/
lib/
  db.ts                   # PrismaClient singleton + isDatabaseReachable()
  env.ts                  # Zod cho biến môi trường
  log.ts                  # log JSON một dòng, request id
  time.ts                 # helper timezone VN (tự viết)
  http.ts                 # map lỗi domain -> HTTP response
  orders/
    errors.ts             # DomainError, NotFoundError, ConflictError, InvalidTransitionError, OrderLockedError
    schema.ts             # Zod schema input (+ version, cursor, idempotency key)
    transitions.ts        # bảng TRANSITIONS + canTransition()
    service.ts            # TOÀN BỘ nghiệp vụ đơn hàng (kèm ghi lịch sử)
  reports/
    revenue.ts            # query báo cáo
prisma/
  schema.prisma
  migrations/
  seed.ts, seed-guard.ts
tests/
  unit/
  integration/
  e2e/
docs/screenshots/
```

## Quy tắc kiến trúc (bắt buộc)

- **Mọi thao tác ghi DB đi qua `lib/orders/service.ts`.** Route handler và Server Action chỉ: parse input → gọi service → trả kết quả / map lỗi. Không gọi `prisma.order.*` ở ngoài service/report.
- **Không tin client:** các field `amount`, `status`, `createdAt`, `id` do client gửi lên khi tạo/sửa đều bị bỏ qua (Zod strip). Server luôn tự tính `amount` và tự đặt `status = NEW` khi tạo.
- **Tiền:** dùng `Prisma.Decimal` cho mọi phép tính; không dùng `number` cho tiền. Trong JSON trả về, tiền là **string** (vd `"150000.00"`). Đơn giá nhận vào phải được chuyển sang Decimal từ **string** để tránh lỗi float.
- **Sửa / đổi trạng thái / xóa** chạy trong `prisma.$transaction`: đọc đơn (chưa xóa mềm) → `NotFoundError` / `OrderLockedError` / `ConflictError` (version client gửi khác version hiện tại) → **update có điều kiện** `updateMany({ where: { id, status, version, deletedAt: null } })` tăng `version` → `count === 0` thì `ConflictError` → ghi `order_events` trong cùng transaction. Không dùng kiểu "đọc rồi ghi" không điều kiện. `PATCH` bắt buộc có `version`; đổi trạng thái/xóa thì tùy chọn.
- **Xóa là xóa mềm** (`deletedAt`). Mọi truy vấn đọc phải lọc `deletedAt: null` (hằng `ACTIVE` trong service; `deleted_at IS NULL` trong SQL báo cáo).
- **Lịch sử (`order_events`) chỉ ghi thêm** (trigger chặn UPDATE/DELETE). Mỗi thay đổi đơn phải ghi đúng một event. Reset dữ liệu chỉ bằng `TRUNCATE` (test, seed).
- **Không có đăng nhập** (người dùng đã quyết định bỏ). Không tự thêm lại auth khi chưa hỏi.
- **Chuyển trạng thái** chỉ được kiểm tra qua bảng `TRANSITIONS` trong `transitions.ts` (dữ liệu, không phải chuỗi if/else).
- **Timezone:** DB lưu UTC (`timestamptz`). "Ngày nghiệp vụ" = Asia/Ho_Chi_Minh (UTC+7, không có DST). Mọi chuyển đổi ngày nằm trong `lib/time.ts`.
- **Lỗi:** service ném lỗi domain; `lib/http.ts` map duy nhất một chỗ:
  - `ZodError` → 400 (kèm lỗi theo field)
  - `NotFoundError` → 404
  - `ConflictError` → 409
  - `InvalidTransitionError` / `OrderLockedError` → 422
  - lỗi khác → 500 (không lộ stack trace; log JSON qua `lib/log.ts`, trả `requestId`)
- **DB là lớp phòng thủ thứ hai:** có CHECK constraint `quantity > 0`, `unit_price > 0`, `version > 0`.
- **Seed** chỉ chạy trên DB đuôi `_dev`/`_test`/`_e2e` (`prisma/seed-guard.ts`); mọi script phá dữ liệu phải có guard tương tự.
- **SQL thô** chỉ dùng tagged template `prisma.$queryRaw\`...\`` (tự tham số hóa). Cấm `$queryRawUnsafe`.
- Tên biến/hàm/file: tiếng Anh. Thông báo lỗi hiển thị cho người dùng và nhãn UI: tiếng Việt.
- Cột DB dạng `snake_case` qua `@map`/`@@map`; model Prisma dạng `camelCase`.

## Lệnh (phải luôn chạy được)

| Lệnh | Việc |
|---|---|
| `npm run db:up` | `docker compose up -d` (Postgres: orders_dev, orders_test, orders_e2e) |
| `npm run db:setup` | migrate + seed DB dev |
| `npm run dev` | chạy app |
| `npm run test:unit` | Vitest unit |
| `npm run test:int` | Vitest integration (dùng DB test) |
| `npm test` | unit + integration |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run check` | typecheck + lint + test — **phải xanh trước khi kết thúc mỗi phase** |
| `npm run e2e` | Playwright trên DB `orders_e2e` (cần `E2E_DATABASE_URL`) |

## Quy trình làm việc

1. Làm **đúng một phase** trong `PLAN.md` mỗi lần, theo thứ tự. Không làm trước phase sau.
2. Với logic nghiệp vụ (service, transitions, report, time): **viết test trước** (thấy đỏ), rồi mới code (xanh).
3. Kết thúc phase:
   - chạy `npm run check` → phải xanh;
   - tick checkbox tương ứng trong `PLAN.md`;
   - commit với message dạng `feat(phase-N): <mô tả>` (hoặc `test:`, `docs:`, `chore:`);
   - **DỪNG lại**, tóm tắt cho người dùng: đã làm gì, file nào thay đổi, quyết định thiết kế nào cần biết để giải thích khi phỏng vấn.
4. Không sửa migration đã tạo — đổi schema thì tạo migration mới.
5. Cấm `any`, `@ts-ignore`, `eslint-disable` (trừ khi có comment giải thích lý do).
6. **Không bao giờ sửa/xóa/skip test chỉ để cho qua.** Test đỏ → sửa code hoặc hỏi người dùng.
7. Gặp chỗ mơ hồ: chọn phương án đơn giản nhất, ghi vào mục **Giả định** trong `README.md`, không tự mở rộng scope.
8. Comment code ngắn, giải thích **vì sao**, không giải thích **cái gì**.
