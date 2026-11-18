import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quản lý đơn hàng",
  description: "Quản lý đơn hàng và báo cáo doanh thu theo ngày",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <header className="site-header">
          <nav>
            <Link href="/orders">Đơn hàng</Link>
            <Link href="/orders/new">Tạo đơn</Link>
            <Link href="/reports/revenue">Báo cáo doanh thu</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
