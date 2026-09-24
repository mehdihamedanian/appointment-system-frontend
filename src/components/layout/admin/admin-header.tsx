"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminNotificationMenu } from "@/components/layout/admin/admin-notification-menu";
import { AdminUserMenu } from "@/components/layout/admin/admin-user-menu";
import { IconButton } from "@/components/ui/icon-button";
import { adminPageTitle } from "@/lib/admin/navigation";

export function AdminHeader({
  pathname,
  collapsed,
  onToggleCollapsed,
  onOpenDrawer,
  entityLabel,
}: {
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenDrawer: () => void;
  entityLabel?: string;
}) {
  const title = adminPageTitle(pathname, entityLabel);

  return (
    <header className="admin-header">
      <div className="admin-header__start">
        <IconButton
          className="admin-menu-btn"
          label="باز کردن منوی مدیریت"
          onClick={onOpenDrawer}
        >
          <Menu size={20} />
        </IconButton>
        <IconButton
          className="desktop-only"
          label={collapsed ? "گستردن نوار کناری" : "جمع کردن نوار کناری"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="icon-dir" size={20} />
          ) : (
            <PanelLeftClose className="icon-dir" size={20} />
          )}
        </IconButton>
        <div className="admin-header__context">
          <AdminBreadcrumb pathname={pathname} entityLabel={entityLabel} compact />
          <p className="admin-header__title visually-hidden">{title}</p>
        </div>
      </div>
      <div className="admin-header__end">
        <AdminNotificationMenu />
        <AdminUserMenu />
      </div>
    </header>
  );
}
