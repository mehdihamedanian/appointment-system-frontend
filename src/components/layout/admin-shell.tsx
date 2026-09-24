"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminHeader } from "@/components/layout/admin/admin-header";
import { AdminMobileDrawer } from "@/components/layout/admin/admin-mobile-drawer";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { useSession } from "@/features/auth/session-provider";
import { filterAdminNavSections } from "@/lib/admin/navigation";
import {
  ADMIN_SIDEBAR_COLLAPSED_PREF,
  readBooleanUiPreference,
  subscribeBooleanUiPreference,
  writeBooleanUiPreference,
} from "@/lib/ui/preferences";
import { cx } from "@/lib/utilities/cx";

function useAdminSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    (listener) => subscribeBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF, listener),
    () => readBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF, false),
    () => false,
  );

  const toggle = useCallback(() => {
    writeBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF, !collapsed);
  }, [collapsed]);

  return [collapsed, toggle];
}

export function AdminShell({
  children,
  entityLabel,
}: {
  children: ReactNode;
  entityLabel?: string;
}) {
  const pathname = usePathname();
  const { user } = useSession();
  const [collapsed, toggleCollapsed] = useAdminSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPathname, setDrawerPathname] = useState(pathname);

  if (drawerPathname !== pathname) {
    setDrawerPathname(pathname);
    if (drawerOpen) {
      setDrawerOpen(false);
    }
  }

  const sections = filterAdminNavSections(user);

  return (
    <div className={cx("admin-shell", collapsed && "is-collapsed")}>
      <AdminSidebar
        className="admin-sidebar--desktop"
        sections={sections}
        pathname={pathname}
        collapsed={collapsed}
      />
      <AdminMobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        pathname={pathname}
      />
      <AdminHeader
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onOpenDrawer={() => setDrawerOpen(true)}
        entityLabel={entityLabel}
      />
      <main id="main-content" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
export { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
export { PermissionGate } from "@/features/admin/permission-gate";
