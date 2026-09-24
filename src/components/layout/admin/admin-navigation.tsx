"use client";

import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { isNavItemActive, type NavSection } from "@/constants/navigation";
import { cx } from "@/lib/utilities/cx";

export function AdminNavigation({
  sections,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="admin-navigation" aria-label="ناوبری مدیریت">
      {sections.map((section) => (
        <div key={section.id} className="admin-nav-section">
          {collapsed ? (
            <h2 className="visually-hidden">{section.label}</h2>
          ) : (
            <h2>{section.label}</h2>
          )}
          <ul className="admin-nav-section__list">
            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const link = (
                <Link
                  href={item.href}
                  className={cx("admin-nav-link", active && "is-active")}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                >
                  <AppIcon name={item.icon} />
                  {collapsed ? (
                    <span className="visually-hidden">{item.label}</span>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
