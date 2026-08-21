"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, LogOut, Menu, PanelLeftClose } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { AppIcon } from "@/components/ui/app-icon";
import { IconButton } from "@/components/ui/icon-button";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import {
  adminNavSections,
  findAdminTitle,
  isNavItemActive,
} from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { useSession } from "@/features/auth/session-provider";
import { cx } from "@/lib/utilities/cx";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = findAdminTitle(pathname);

  async function onLogout() {
    await logout();
    router.replace(routes.auth.login);
  }

  const nav = (
    <nav aria-label="ناوبری مدیریت">
      {adminNavSections.map((section) => {
        const items = section.items.filter((item) =>
          isCapabilityVisible(defaultCapabilities, item.capability),
        );
        if (items.length === 0) {
          return null;
        }

        return (
          <div key={section.id} className="admin-nav-section">
            {collapsed ? null : <h2>{section.label}</h2>}
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                title={item.label}
                onClick={() => setDrawerOpen(false)}
              >
                <AppIcon name={item.icon} />
                {collapsed ? <span className="visually-hidden">{item.label}</span> : item.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={cx("admin-shell", collapsed && "is-collapsed")}>
      <aside className="admin-sidebar">
        <Brand compact={collapsed} />
        {nav}
      </aside>
      {drawerOpen ? (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <aside className="admin-sidebar is-drawer">
            <Brand />
            {nav}
          </aside>
        </>
      ) : null}
      <header className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
          <IconButton
            className="admin-menu-btn"
            label="باز کردن منوی مدیریت"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </IconButton>
          <IconButton
            className="desktop-only"
            label={collapsed ? "گستردن نوار کناری" : "جمع کردن نوار کناری"}
            onClick={() => setCollapsed((current) => !current)}
          >
            <PanelLeftClose className="icon-dir" size={20} />
          </IconButton>
          <nav className="breadcrumb" aria-label="مسیر صفحه">
            <span>پنل مدیریت</span>
            <ChevronRight className="icon-dir" size={14} aria-hidden="true" />
            <span aria-current="page">{title}</span>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <IconButton
            label="اعلان‌ها"
            onClick={() => router.push(routes.admin.notifications)}
          >
            <Bell size={20} />
          </IconButton>
          <span className="brand__tagline" dir="auto">
            {user?.displayName ?? "حساب کاربری"}
          </span>
          <IconButton label="خروج از حساب" onClick={() => void onLogout()}>
            <LogOut size={20} />
          </IconButton>
        </div>
      </header>
      <main id="main-content" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
