import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, SiteNav } from "./site-nav";
import "./globals.css";

// next/font downloads these at build time and serves them from our own domain.
// The "vietnamese" subset carries the stacked diacritics (ệ, ở, ữ…).
const geist = Geist({ subsets: ["latin", "vietnamese"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Quản lý đơn hàng",
  description: "Quản lý đơn hàng và báo cáo doanh thu theo ngày",
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Bỏ qua đến nội dung
        </a>
        <header className="site-header">
          <div className="wrap site-header__inner">
            <Link href="/orders" className="brand">
              <span className="brand__mark" aria-hidden="true" />
              <span className="brand__name">Quản lý đơn hàng</span>
            </Link>
            <Suspense fallback={<NavLinks pathname={null} />}>
              <SiteNav />
            </Suspense>
          </div>
        </header>
        <main id="main" className="wrap">
          {children}
        </main>
      </body>
    </html>
  );
}
