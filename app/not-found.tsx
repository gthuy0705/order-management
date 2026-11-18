import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-head">
      <h1>Không tìm thấy</h1>
      <p className="muted">
        Trang hoặc đơn hàng không tồn tại.{" "}
        <Link href="/orders" className="link">
          Về danh sách đơn hàng
        </Link>
      </p>
    </div>
  );
}
