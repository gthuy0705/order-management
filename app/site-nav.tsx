"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/orders", label: "Đơn hàng" },
  { href: "/reports/revenue", label: "Báo cáo" },
] as const;

const NEW_ORDER = "/orders/new";

// Reads the URL so the current page can be marked. With cacheComponents the
// pathname of /orders/[id] is only known per request, so the layout renders
// this inside <Suspense> with <NavLinks pathname={null} /> as the fallback.
export function SiteNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  const onNewOrder = pathname === NEW_ORDER;

  return (
    <nav className="site-nav" aria-label="Điều hướng chính">
      {LINKS.map((link) => {
        // An order's detail page still belongs to "Đơn hàng"; the new-order
        // page is marked on its own button instead.
        const current = !onNewOrder && pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="nav-link"
            aria-current={current ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      {/* The main action. On its own page it turns secondary, so that page's
          "Tạo đơn" submit button is the only filled one on screen. */}
      <Link
        href={NEW_ORDER}
        className={`btn btn--sm ${onNewOrder ? "btn--secondary" : "btn--primary"}`}
        aria-current={onNewOrder ? "page" : undefined}
      >
        Tạo đơn
      </Link>
    </nav>
  );
}
