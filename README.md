# Order Management

> README đầy đủ được hoàn thiện ở Phase 8.

## API — ví dụ `curl`

Tiền trong JSON luôn là **string** (vd `"150000.00"`). Lỗi trả về dạng `{ "error": "...", "fieldErrors"?: { field: [msg] } }`.

```bash
B=http://localhost:3000/api

# Tạo đơn → 201 (amount/status client gửi lên bị bỏ qua)
curl -X POST $B/orders -H 'content-type: application/json' \
  -d '{"customerName":"Nguyen Van A","productName":"But bi","quantity":2,"unitPrice":"150000"}'

# Danh sách (lọc tùy chọn: NEW | DELIVERED | CANCELLED)
curl "$B/orders?status=NEW"

# Chi tiết → 404 nếu không tồn tại
curl $B/orders/<id>

# Sửa đơn NEW (gửi đủ 4 field) → 422 nếu đơn đã chốt
curl -X PATCH $B/orders/<id> -H 'content-type: application/json' \
  -d '{"customerName":"Nguyen Van A","productName":"But bi","quantity":3,"unitPrice":"150000"}'

# Đổi trạng thái: DELIVERED | CANCELLED → 422 nếu đơn đã chốt, 409 nếu vừa bị đổi ở nơi khác
curl -X POST $B/orders/<id>/status -H 'content-type: application/json' -d '{"status":"DELIVERED"}'

# Xóa đơn NEW → 204
curl -X DELETE $B/orders/<id>

# Báo cáo doanh thu (ngày giờ VN, bao gồm 2 đầu; mặc định 30 ngày gần nhất)
curl "$B/reports/revenue?from=2026-11-01&to=2026-11-18"

# Dữ liệu sai → 400 kèm lỗi theo field
curl -X POST $B/orders -H 'content-type: application/json' \
  -d '{"customerName":"A","productName":"B","quantity":0,"unitPrice":"0"}'
```

> Trên Windows (Git Bash/cmd), tham số dòng lệnh có thể không được gửi dưới dạng UTF-8 — nên dùng ví dụ không dấu như trên, hoặc `--data-binary @body.json`.
