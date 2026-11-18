import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

// The app chrome (header, nav, user menu) lives in app/(app)/layout.tsx, so
// /login renders without links that would only bounce back to /login.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
