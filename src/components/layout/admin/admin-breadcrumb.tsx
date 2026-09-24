"use client";

import Link from "next/link";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/page-header";
import { buildAdminBreadcrumbs } from "@/lib/admin/navigation";

export function AdminBreadcrumb({
  pathname,
  entityLabel,
  items,
  compact = false,
}: {
  pathname: string;
  entityLabel?: string;
  items?: BreadcrumbItem[];
  compact?: boolean;
}) {
  const crumbs = items ?? buildAdminBreadcrumbs(pathname, entityLabel);
  const display = compact && crumbs.length > 2 ? [crumbs[0]!, crumbs[crumbs.length - 1]!] : crumbs;

  return (
    <Breadcrumb
      className={compact ? "admin-breadcrumb admin-breadcrumb--compact" : "admin-breadcrumb"}
      items={display.map((item) =>
        item.href
          ? { href: item.href, label: item.label }
          : { label: item.label },
      )}
    />
  );
}

/** Re-export Link helper for dynamic crumbs built outside the shell. */
export function adminCrumbLink(href: string, label: string): BreadcrumbItem {
  return { href, label };
}

export function AdminBreadcrumbFallback() {
  return (
    <nav aria-label="مسیر صفحه" className="admin-breadcrumb">
      <ol className="ds-breadcrumb">
        <li>
          <Link href="/admin">پنل مدیریت</Link>
          <span aria-hidden="true">/</span>
        </li>
        <li>
          <span aria-current="page">…</span>
        </li>
      </ol>
    </nav>
  );
}
