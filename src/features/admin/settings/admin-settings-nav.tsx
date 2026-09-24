"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import {
  canAccessSettingsSection,
  settingsSectionHref,
} from "@/lib/admin/settings-filters";
import { cx } from "@/lib/utilities/cx";
import {
  ADMIN_SETTINGS_SECTION_LABELS,
  ADMIN_SETTINGS_SECTIONS,
} from "@/types/admin-settings";

export function AdminSettingsNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const codes = user?.permissionCodes ?? [];

  const sections = ADMIN_SETTINGS_SECTIONS.filter((section) =>
    canAccessSettingsSection(codes, section),
  );

  if (sections.length === 0) return null;

  return (
    <nav className="admin-settings-hub-nav" aria-label="بخش‌های تنظیمات" role="tablist">
      {sections.map((section) => {
        const href = settingsSectionHref(section);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={section}
            href={href}
            role="tab"
            className={cx("admin-settings-hub-nav__link", active && "is-active")}
            aria-selected={active}
            aria-current={active ? "page" : undefined}
          >
            {ADMIN_SETTINGS_SECTION_LABELS[section]}
          </Link>
        );
      })}
    </nav>
  );
}
