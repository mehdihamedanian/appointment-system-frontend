"use client";

import { Brand } from "@/components/layout/brand";
import { AdminNavigation } from "@/components/layout/admin/admin-navigation";
import type { NavSection } from "@/constants/navigation";
import { cx } from "@/lib/utilities/cx";

export function AdminSidebar({
  sections,
  pathname,
  collapsed,
  className,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  collapsed: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <aside className={cx("admin-sidebar", className)} aria-label="نوار کناری مدیریت">
      <Brand compact={collapsed} />
      <div className="admin-sidebar__scroll">
        <AdminNavigation
          sections={sections}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}
