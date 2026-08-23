"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { AppIcon } from "@/components/ui/app-icon";
import { IconButton } from "@/components/ui/icon-button";
import { CustomerNotificationBell } from "@/features/customer/customer-notification-bell";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import {
  customerNavItems,
  customerSecondaryNavItems,
  isNavItemActive,
} from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { useSession } from "@/features/auth/session-provider";
import type { ReactNode } from "react";

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useSession();

  async function onLogout() {
    await logout();
    router.replace(routes.auth.login);
  }

  const secondary = customerSecondaryNavItems.filter((item) =>
    isCapabilityVisible(defaultCapabilities, item.capability),
  );

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <Brand compact />
        <nav className="customer-nav-desktop desktop-only" aria-label="ناوبری حساب">
          {customerNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {secondary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="customer-header__actions">
          <CustomerNotificationBell />
          <IconButton label="خروج از حساب" onClick={() => void onLogout()}>
            <LogOut size={20} />
          </IconButton>
        </div>
      </header>
      <main id="main-content" className="customer-main" tabIndex={-1}>
        {user?.displayName ? (
          <p className="visually-hidden">حساب {user.displayName}</p>
        ) : null}
        {children}
      </main>
      <nav className="customer-bottom-nav" aria-label="ناوبری همراه حساب">
        {customerNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
            data-emphasis={item.icon === "booking" ? "true" : undefined}
          >
            <span>
              <AppIcon name={item.icon} />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
