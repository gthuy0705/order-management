# PLAN.md — Kế hoạch triển khai

> Đọc `CLAUDE.md` trước. Làm từng phase theo thứ tự; mỗi phase kết thúc bằng `npm run check` xanh + commit + DỪNG để người dùng review.

## Ghi chú review của tech lead (2026-11-18)

Plan **được duyệt** với các điều chỉnh sau (đã sửa trực tiếp trong từng phase bên dưới, đánh dấu *[TL]*):

1. **Pin phiên bản Prisma 6.19.x.** Tag `latest` trên npm hiện là `8.0.0-rc` (chưa ổn định); Prisma 7+ bắt buộc driver adapter (`@prisma/adapter-pg`, `pg`) + `prisma.config.ts` — tức là thêm dependency ngoài danh sách và đổi cách import `Prisma.Decimal`. Prisma 6 khớp đúng mọi đoạn code trong plan.
2. **Next.js 16**: `next lint` đã bị bỏ → script `lint` gọi thẳng `eslint`. `params` là `Promise` (đã ghi ở Phase 5).
3. **Zod 4**: dùng `z.flattenError(err)` thay cho `err.flatten()` (deprecated) để lấy `fieldErrors`.
4. **Vitest không tự nạp `.env`** vào `process.env` → `vitest.config.ts` dùng `loadEnv` của Vite (không thêm dependency). Project `integration` ép `DATABASE_URL = TEST_DATABASE_URL`, và **từ chối chạy** nếu `TEST_DATABASE_URL` trùng `DATABASE_URL` (bảo vệ dữ liệu dev khỏi `migrate reset`/`TRUNCATE`).
5. **Tách `globalSetup` và `setupFiles`**: `globalSetup` chạy 1 lần trong process riêng (không dùng được `beforeEach`). → `tests/integration/global-setup.ts` (migrate reset) + `tests/integration/setup.ts` (`beforeEach` TRUNCATE). Cả hai được thêm ở **Phase 3** (Phase 0 chưa có schema nên `migrate reset` sẽ lỗi).
6. **Thứ tự seed**: seed phụ thuộc service (Phase 2) → chuyển hẳn seed về **cuối Phase 2**. Ở Phase 0–1, `db:setup` chỉ là `prisma migrate deploy`; thêm `&& tsx prisma/seed.ts` khi seed tồn tại.
7. **`postinstall: prisma generate`** để bản clone sạch / CI có Prisma Client ngay sau `npm ci` (làm ngay ở Phase 0).
8. Bổ sung chi tiết còn thiếu: `calcAmount` đặt ở `lib/orders/money.ts` (thuần, unit test không cần DB); `deleteOrder` phân biệt NotFound/Locked giống `updateOrder`; `listOrders` validate `status` bằng Zod (sai → 400); `lib/time.ts` thêm `addDays`; lỗi validate khoảng ngày báo cáo dùng Zod (→ 400).
9. Thư mục chưa là git repo → `git init` ở Phase 0. Phase 7 "CI xanh trên GitHub" chỉ xác nhận được khi người dùng push lên remote.

---

## Phase 0 — Khởi tạo dự án

- [x] `create-next-app` với TypeScript, App Router, ESLint, **không** Tailwind, không `src/` dir.
- [x] Bật `"strict": true` trong `tsconfig.json`; alias `@/*`.
- [x] `docker-compose.yml`: một service Postgres 16, tạo 2 database `orders_dev` và `orders_test` (dùng script init trong `docker/init.sql`), port 5432, có healthcheck.
- [x] `.env.example`:
  ```
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orders_dev
  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orders_test
  ```
  `.env` nằm trong `.gitignore`.
- [x] `git init`. *[TL]*
- [x] Cài: `prisma@6.19.x`, `@prisma/client@6.19.x` (pin, xem ghi chú 1), `zod`, `vitest`, `tsx` (chạy seed).
- [x] `vitest.config.mts` *[TL: đuôi `.mts` để Vite nạp config dạng ESM, hết cảnh báo]* với 2 project: `unit` (`tests/unit/**`) và `integration` (`tests/integration/**`, `fileParallelism: false`, env `DATABASE_URL = TEST_DATABASE_URL` + guard chống trùng DB dev). *[TL]* `globalSetup`/`setupFiles` thêm ở Phase 3.
- [x] Scripts trong `package.json` đúng bảng ở `CLAUDE.md` (`db:up`, `db:setup`, `test`, `test:unit`, `test:int`, `typecheck`, `lint`, `check`). *[TL]* `db:setup` tạm thời = `prisma migrate deploy` (seed thêm ở cuối Phase 2).
- [x] `lib/db.ts`: PrismaClient singleton (tránh tạo nhiều client khi hot reload).
- [x] *[TL — phát sinh khi làm]* `prisma/schema.prisma` khung (chỉ `generator` + `datasource`) và `"postinstall": "prisma generate"` làm luôn ở Phase 0 — `lib/db.ts` cần Prisma Client đã generate thì mới typecheck được.
- [x] *[TL — phát sinh khi làm]* `typecheck` = `next typegen && tsc --noEmit`: Next 16 sinh type toàn cục (`LayoutProps`, `PageProps`…) vào `.next/types`, chạy `tsc` trên clone sạch sẽ lỗi nếu chưa typegen.
- [x] *[TL — phát sinh khi làm]* Vitest 5 yêu cầu **Node ≥ 22.12** (Node 20 đã EOL 04/2026) → `engines.node = ">=22.12"`, `@types/node@22`.

**Tiêu chí xong:** `npm run db:up` chạy; `npm run dev` mở được trang mặc định; `npm run check` xanh (chưa có test thì vitest `passWithNoTests`).

---

## Phase 1 — Database schema

- [x] `prisma/schema.prisma` (thêm vào file khung đã có từ Phase 0):
  ```prisma
  enum OrderStatus { NEW DELIVERED CANCELLED }

  model Order {
    id           String      @id @default(cuid())
    customerName String      @map("customer_name")
    productName  String      @map("product_name")
    quantity     Int
    unitPrice    Decimal     @map("unit_price") @db.Decimal(18, 2)
    amount       Decimal     @db.Decimal(18, 2)
    status       OrderStatus @default(NEW)
    createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)
    updatedAt    DateTime    @updatedAt      @map("updated_at") @db.Timestamptz(3)

    @@index([status, createdAt])
    @@map("orders")
  }
  ```
- [x] Migration `init`; sau đó tạo migration thứ hai **viết tay SQL** thêm:
  ```sql
  ALTER TABLE orders ADD CONSTRAINT orders_quantity_positive   CHECK (quantity > 0);
  ALTER TABLE orders ADD CONSTRAINT orders_unit_price_positive CHECK (unit_price > 0);
  ```
- [x] *[TL]* Seed **chuyển sang cuối Phase 2** (cần service).

**Tiêu chí xong:** migrate chạy sạch trên DB mới; insert tay `quantity = 0` bị Postgres từ chối.

---

## Phase 2 — Domain logic (TDD)

Viết test **trước**, trong `tests/unit/`:

- [x] `lib/orders/transitions.ts`
  ```ts
  export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    NEW: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  };
  export function canTransition(from: OrderStatus, to: OrderStatus): boolean
  ```
  Test: bảng đầy đủ 3×3 cặp (from, to), chỉ 2 cặp hợp lệ; `NEW → NEW` không hợp lệ.
- [x] `lib/orders/errors.ts`: `DomainError` (base) → `NotFoundError`, `ConflictError`, `InvalidTransitionError`, `OrderLockedError`. Message tiếng Việt.
- [x] `lib/orders/schema.ts`:
  - `orderInputSchema`: `customerName`, `productName` (trim, 1–200 ký tự); `quantity` (số nguyên > 0, nhận cả string từ form); `unitPrice` (nhận string|number → chuẩn hóa thành string → regex `^\d+(\.\d{1,2})?$` → > 0).
  - Field lạ (`amount`, `status`, …) bị strip.
  - `statusChangeSchema`: `{ status: z.enum(["DELIVERED","CANCELLED"]) }`.
  - Test: 0, số âm, số thập phân cho quantity, chuỗi rỗng, quá 2 chữ số thập phân, input có `amount` → bị bỏ.
- [x] `lib/orders/money.ts` *[TL]*: `calcAmount(quantity: number, unitPrice: Prisma.Decimal): Prisma.Decimal` — test cả số lớn (vd 1 000 000 × 999 999 999.99) không mất chính xác.
- [x] `lib/orders/service.ts`:
  - `createOrder(input: unknown)` — parse → tính amount → `status: "NEW"`.
  - `updateOrder(id, input: unknown)` — parse → `updateMany({ where: { id, status: "NEW" } })` → `count === 0` thì đọc lại: không có → `NotFoundError`; có nhưng khác NEW → `OrderLockedError`.
  - `changeStatus(id, to)` — đọc đơn → `canTransition` sai thì `InvalidTransitionError` (đơn đã chốt thì `OrderLockedError`) → `updateMany({ where: { id, status: current } })` → `count === 0` → `ConflictError`.
  - `getOrder(id)`, `listOrders({ status? })` (sắp xếp `createdAt desc`; *[TL]* `status` validate bằng Zod, giá trị lạ → `ZodError`).
  - `deleteOrder(id)` — chỉ xóa được khi NEW (`deleteMany` có điều kiện); *[TL]* `count === 0` → đọc lại: không có → `NotFoundError`, có → `OrderLockedError`.
  - Hàm `toOrderDTO(order)` chuyển Decimal → string, Date → ISO string.
- [x] *[TL — chuyển từ Phase 1]* `prisma/seed.ts`: ~15 đơn mẫu, trải trên 5–7 ngày gần nhất, đủ cả 3 trạng thái; có ít nhất 1 đơn tạo lúc 00:30 giờ VN (để demo timezone). Seed **ghi qua service** (`createOrder`, `changeStatus`) rồi chỉ chỉnh `createdAt` bằng update trực tiếp — ghi chú lý do trong comment. Seed xóa dữ liệu cũ trước khi tạo (chạy lại được nhiều lần).
- [x] *[TL]* `npm run db:setup` = `prisma migrate deploy && tsx prisma/seed.ts`.

- [x] *[phát sinh khi làm]* `changeStatus(id, input)` nhận object `{ status }` (giống `createOrder(input: unknown)`): service tự parse bằng `statusChangeSchema`, route/Server Action chỉ chuyển body/form vào.
- [x] *[phát sinh khi làm]* Giới hạn trên: `quantity` ≤ INT4 max, thành tiền ≤ `9999999999999999.99` (vừa `Decimal(18,2)`) — vượt thì 400 thay vì lỗi DB 500.
- [x] *[phát sinh khi làm]* Zod 4 vẫn chạy các check sau khi một check fail → `regex` của đơn giá dùng `abort: true` để `refine` không gặp chuỗi không phải số.

**Tiêu chí xong:** unit test xanh; service chưa cần test với DB (để Phase 3); `npm run db:setup` chạy được.

---

## Phase 3 — Integration test cho service (DB test thật)

- [x] *[TL]* `tests/integration/global-setup.ts` (khai báo ở `globalSetup`): ~~chạy `prisma migrate reset --force --skip-seed`~~ → *[phát sinh khi làm]* chạy `prisma migrate deploy` trên `TEST_DATABASE_URL`. Prisma 6 chặn `migrate reset` khi được gọi bởi AI agent (đòi xác nhận của người dùng mỗi lần). `deploy` không phá dữ liệu, idempotent; cô lập dữ liệu giữa các test đã do `TRUNCATE` trong `beforeEach` đảm bảo.
- [x] *[TL]* `tests/integration/setup.ts` (khai báo ở `setupFiles`): `beforeEach` chạy `TRUNCATE orders`; `afterAll` `$disconnect`.
- [x] Test case (mỗi case một `it`, tên tiếng Việt mô tả hành vi):
  1. Tạo đơn: `amount` = quantity × unitPrice; `amount` client gửi lên bị bỏ qua.
  2. Tạo đơn với `status: "DELIVERED"` → đơn vẫn là `NEW`.
  3. `quantity` / `unitPrice` = 0 hoặc âm → `ZodError`, DB không có bản ghi.
  4. `NEW → DELIVERED` và `NEW → CANCELLED` thành công.
  5. Từ `DELIVERED`/`CANCELLED` đổi sang bất kỳ → lỗi; status trong DB không đổi.
  6. Sửa đơn `DELIVERED` → `OrderLockedError`; dữ liệu không đổi.
  7. Sửa đơn `NEW` → `amount` được tính lại.
  8. **Đồng thời:** *(bên thua có thể nhận `ConflictError` — thua ở update có điều kiện — hoặc `OrderLockedError` — đọc sau khi bên thắng đã commit; cả hai đều đúng)* `Promise.allSettled([changeStatus(id,"DELIVERED"), changeStatus(id,"CANCELLED")])` → đúng **1** fulfilled, 1 rejected; trạng thái cuối khớp với cái fulfilled.
  9. Xóa đơn đã chốt → lỗi; xóa đơn `NEW` → thành công.
  10. Id không tồn tại → `NotFoundError` (get/update/changeStatus).
- [x] CHECK constraint: insert trực tiếp bằng Prisma với `quantity: 0` → Postgres báo lỗi (chứng minh lớp phòng thủ thứ hai).

**Tiêu chí xong:** `npm run test:int` xanh, chạy 3 lần liên tiếp vẫn xanh (không flaky).

---

## Phase 4 — Báo cáo doanh thu (TDD)

- [ ] `lib/time.ts` (tự viết, không dùng thư viện):
  - `VN_OFFSET_MINUTES = 7 * 60`
  - `vnDayStartUtc(day: "YYYY-MM-DD"): Date` — 00:00 giờ VN của ngày đó, ở dạng UTC.
  - `vnToday(): "YYYY-MM-DD"`
  - `parseDayParam(s: string): string` — validate định dạng + ngày có thật (vd từ chối `2026-02-30`).
  - *[TL]* `addDays(day: string, n: number): string` — dùng cho `to + 1 ngày` và mặc định "30 ngày gần nhất".
  - Unit test: `vnDayStartUtc("2026-11-18")` = `2026-11-17T17:00:00.000Z`; ngày không hợp lệ ném lỗi.
- [ ] `lib/reports/revenue.ts`:
  ```ts
  revenueByDay({ from, to }: { from: string; to: string }) // ngày VN, bao gồm cả 2 đầu
  ```
  - `to` phải ≥ `from`; khoảng tối đa 366 ngày → lỗi validate (*[TL]* ném `ZodError` để map thống nhất sang 400).
  - Khoảng UTC: `[vnDayStartUtc(from), vnDayStartUtc(to + 1 ngày))`.
  - SQL (tagged template):
    ```sql
    SELECT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int    AS orders,
           SUM(amount)::text AS revenue
    FROM orders
    WHERE status = 'DELIVERED'
      AND created_at >= ${fromUtc} AND created_at < ${toUtcExclusive}
    GROUP BY 1
    ORDER BY 1
    ```
  - Trả thêm dòng tổng: `{ rows, total: { orders, revenue } }` (tổng tính bằng Decimal ở TS).
  - Ngày không có đơn: **không** có dòng (ghi vào Giả định).
- [ ] Integration test:
  1. Chỉ đếm `DELIVERED` (có đơn NEW, CANCELLED cùng ngày → không tính).
  2. Đơn tạo `2026-11-17T17:30:00Z` (= 00:30 ngày 18/11 giờ VN) nằm ở dòng `2026-11-18`.
  3. Đơn tạo `2026-11-17T16:59:59Z` (= 23:59:59 ngày 17/11 giờ VN) nằm ở dòng `2026-11-17`.
  4. Lọc `from`/`to` bao gồm đúng biên.
  5. Tổng `revenue` chính xác với số thập phân.

**Tiêu chí xong:** test xanh; chạy được với seed data.

---

## Phase 5 — API (route handlers)

- [ ] `lib/http.ts`: `handleError(e): Response` theo bảng map lỗi trong `CLAUDE.md`; `json(data, status)`. ZodError trả `{ error, fieldErrors }`.
- [ ] Routes (lưu ý: Next.js 15+ `params` là `Promise` → `await params`):
  | Method | Path | Service |
  |---|---|---|
  | `GET` | `/api/orders?status=` | `listOrders` |
  | `POST` | `/api/orders` | `createOrder` → 201 |
  | `GET` | `/api/orders/[id]` | `getOrder` |
  | `PATCH` | `/api/orders/[id]` | `updateOrder` |
  | `DELETE` | `/api/orders/[id]` | `deleteOrder` → 204 |
  | `POST` | `/api/orders/[id]/status` | `changeStatus` |
  | `GET` | `/api/reports/revenue?from=&to=` | `revenueByDay` (mặc định 30 ngày gần nhất) |
- [ ] JSON body không parse được → 400 (không để rơi vào 500).
- [ ] Integration test gọi trực tiếp hàm `GET`/`POST`… export từ `route.ts` với `new Request(...)`: kiểm tra status code 201/400/404/409/422 và shape JSON (tiền là string).

**Tiêu chí xong:** test xanh; thử nhanh bằng `curl` (ghi các lệnh mẫu vào README).

---

## Phase 6 — Giao diện

*[TL]* Next 16 bật sẵn `cacheComponents` (dữ liệu mặc định là động, không cache ngầm): trang đọc DB bọc phần đọc dữ liệu trong `<Suspense>` (hoặc `loading.tsx`); không dùng `"use cache"` cho dữ liệu đơn hàng.

Không dùng UI library; một file `app/globals.css` nhỏ (bảng, form, badge trạng thái, thông báo lỗi). Mutation dùng **Server Actions gọi service** (không gọi qua fetch API nội bộ).

- [ ] Layout có nav: "Đơn hàng", "Tạo đơn", "Báo cáo doanh thu".
- [ ] `/orders`: bảng (mã, khách hàng, mặt hàng, SL, đơn giá, thành tiền, trạng thái, ngày tạo giờ VN); filter theo trạng thái qua `searchParams`; badge màu theo trạng thái.
- [ ] `/orders/new`: form; hiển thị **thành tiền tạm tính** phía client (chỉ để xem — server vẫn tính lại); hiển thị lỗi theo từng field trả về từ server; dùng `useActionState`.
- [ ] `/orders/[id]`:
  - Đơn `NEW`: form sửa + nút **"Đánh dấu đã giao"**, **"Hủy đơn"** (có `confirm`), **"Xóa"**.
  - Đơn đã chốt: hiển thị read-only + dòng thông báo "Đơn đã chốt, không thể chỉnh sửa".
  - Lỗi 409 (xung đột) hiển thị: "Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang".
- [ ] `/reports/revenue`: form chọn từ ngày / đến ngày (mặc định 30 ngày gần nhất); bảng Ngày | Số đơn | Doanh thu; dòng Tổng cộng; định dạng tiền `vi-VN` (`150.000 ₫`) — format chuỗi Decimal, không ép sang number nếu có thể.
- [ ] Format ngày giờ hiển thị theo `Asia/Ho_Chi_Minh` (dùng `Intl.DateTimeFormat` có sẵn).
- [ ] `revalidatePath` sau mỗi mutation.

**Tiêu chí xong:** tự đi qua luồng: tạo đơn (thử nhập SL = 0 thấy lỗi) → giao → thử sửa (bị chặn) → xem báo cáo thấy đơn vừa giao.

---

## Phase 7 — E2E, CI, ảnh chụp (điểm cộng)

- [ ] Cài Playwright (chỉ Chromium). 1 test e2e: tạo đơn → đánh dấu đã giao → mở báo cáo → thấy số đơn và doanh thu tăng.
- [ ] Script `npm run screenshots` (Playwright) chụp và lưu vào `docs/screenshots/`:
  `01-danh-sach.png`, `02-tao-don.png`, `03-loi-validate.png`, `04-doi-trang-thai.png`, `05-don-da-chot.png`, `06-bao-cao.png`.
- [ ] `.github/workflows/ci.yml`: service Postgres 16 → `npm ci` → `prisma migrate deploy` → `npm run check`.

**Tiêu chí xong:** CI xanh trên GitHub; ảnh có trong repo.

---

## Phase 8 — README & kiểm tra cuối

- [ ] `README.md` (tiếng Việt):
  1. Giới thiệu 2 dòng + lý do chọn Next.js thay vì Frappe (đề cho phép framework quen thuộc).
  2. Yêu cầu: Node 22.12+, Docker.
  3. Cài & chạy: `cp .env.example .env` → `npm ci` → `npm run db:up` → `npm run db:setup` → `npm run dev`.
  4. Chạy test: `npm test`, `npm run e2e`.
  5. Ví dụ `curl` cho từng API.
  6. **Giả định** (khách hàng/mặt hàng là text; VND Decimal(18,2); ngày theo giờ VN; không xóa đơn đã chốt; ngày không có đơn không hiện dòng; không có đăng nhập…).
  7. **Quyết định thiết kế:** một lớp service; update có điều kiện chống race; bảng TRANSITIONS; Decimal cho tiền; CHECK constraint; xử lý timezone.
  8. **Hướng mở rộng khi dữ liệu lớn:** bảng tổng hợp `daily_revenue` cập nhật trong transaction đổi trạng thái (an toàn vì đơn chỉ vào báo cáo đúng một lần và không thay đổi sau đó).
  9. **Chưa làm / có thể cải thiện:** auth & phân quyền, phân trang, bảng khách hàng/mặt hàng riêng, nhiều mặt hàng mỗi đơn.
  10. Ảnh chụp màn hình (nhúng từ `docs/screenshots/`).
- [ ] **Kiểm tra trên bản clone sạch:** `git clone` ra thư mục tạm → làm đúng theo README từng bước → app chạy và `npm run check` xanh. Sửa README nếu có bước thiếu.
- [ ] Rà soát: không còn `console.log` thừa, TODO, code chết, file `.env` không bị commit.

**Tiêu chí xong:** người khác chỉ đọc README là chạy được.
