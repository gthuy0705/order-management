import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <main id="main" className="wrap login">
      <div className="login__card panel panel--pad">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Quản lý đơn hàng</span>
        </div>
        <h1>Đăng nhập</h1>
        {/* Reads ?next= from the URL, so it renders per request. */}
        <Suspense fallback={<p className="muted">Đang tải…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
