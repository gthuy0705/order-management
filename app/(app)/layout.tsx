import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavLinks, SiteNav } from "./site-nav";
import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua đến nội dung
      </a>
      <header className="site-header">
        <div className="wrap site-header__inner">
          <Link href="/orders" className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">Quản lý đơn hàng</span>
          </Link>
          <div className="site-header__end">
            <Suspense fallback={<NavLinks pathname={null} />}>
              <SiteNav />
            </Suspense>
            {/* Reads the session cookie, so it streams in after the static shell. */}
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main" className="wrap">
        {children}
      </main>
    </>
  );
}
