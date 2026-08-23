"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/constants/routes";

const PROFILE_NAV: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: routes.customer.profile, label: "نمای کلی", exact: true },
  { href: routes.customer.profileEdit, label: "ویرایش مشخصات" },
  { href: routes.customer.profileSecurity, label: "امنیت" },
  { href: routes.customer.profileNotifications, label: "اعلان‌ها" },
];

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <nav className="profile-nav" aria-label="بخش‌های حساب کاربری">
      <ul className="profile-nav__list">
        {PROFILE_NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="profile-nav__link"
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
