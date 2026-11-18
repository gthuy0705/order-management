import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Không tìm thấy</h1>
      <p>
        Trang hoặc đơn hàng không tồn tại. <Link href="/orders">Về danh sách đơn hàng</Link>
      </p>
    </>
  );
}
