import type { CapabilityKey } from "@/config/capabilities";
import { routes } from "@/constants/routes";

export type NavIconName =
  | "home"
  | "calendar"
  | "booking"
  | "bell"
  | "user"
  | "overview"
  | "appointments"
  | "customers"
  | "services"
  | "staff"
  | "resources"
  | "branches"
  | "payments"
  | "waitingList"
  | "reports"
  | "users"
  | "roles"
  | "settings"
  | "activity"
  | "wallet";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  capability?: CapabilityKey;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const publicNavItems: NavItem[] = [
  { href: routes.public.home, label: "خانه", icon: "home" },
  { href: routes.public.services, label: "خدمات", icon: "services" },
];

export const customerNavItems: NavItem[] = [
  { href: routes.customer.dashboard, label: "خانه", icon: "home" },
  { href: routes.customer.appointments, label: "نوبت‌ها", icon: "calendar" },
  { href: routes.customer.booking, label: "رزرو", icon: "booking" },
  { href: routes.customer.notifications, label: "اعلان‌ها", icon: "bell" },
  { href: routes.customer.profile, label: "حساب", icon: "user" },
];

export const customerSecondaryNavItems: NavItem[] = [
  {
    href: routes.customer.payments,
    label: "پرداخت‌ها",
    icon: "wallet",
    capability: "onlinePayments",
  },
];

export const adminNavSections: NavSection[] = [
  {
    id: "operations",
    label: "عملیات",
    items: [
      { href: routes.admin.home, label: "نمای کلی", icon: "overview" },
      { href: routes.admin.appointments, label: "نوبت‌ها", icon: "appointments" },
      { href: routes.admin.calendar, label: "تقویم", icon: "calendar" },
      { href: routes.admin.customers, label: "مشتریان", icon: "customers" },
      {
        href: routes.admin.waitingList,
        label: "لیست انتظار",
        icon: "waitingList",
        capability: "waitingList",
      },
    ],
  },
  {
    id: "catalog",
    label: "خدمات و منابع",
    items: [
      { href: routes.admin.services, label: "خدمات", icon: "services" },
      { href: routes.admin.staff, label: "کارکنان", icon: "staff" },
      { href: routes.admin.resources, label: "منابع", icon: "resources" },
      {
        href: routes.admin.branches,
        label: "شعب",
        icon: "branches",
        capability: "multipleBranches",
      },
    ],
  },
  {
    id: "finance",
    label: "مالی و ارتباط",
    items: [
      {
        href: routes.admin.payments,
        label: "پرداخت‌ها",
        icon: "payments",
        capability: "onlinePayments",
      },
      { href: routes.admin.notifications, label: "اعلان‌ها", icon: "bell" },
    ],
  },
  {
    id: "organization",
    label: "سازمان",
    items: [
      { href: routes.admin.reports, label: "گزارش‌ها", icon: "reports" },
      { href: routes.admin.users, label: "کاربران", icon: "users" },
      { href: routes.admin.roles, label: "نقش‌ها", icon: "roles" },
      { href: routes.admin.settings, label: "تنظیمات", icon: "settings" },
      { href: routes.admin.activityLogs, label: "رویدادها", icon: "activity" },
    ],
  },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === routes.public.home) {
    return pathname === href;
  }

  if (href === routes.admin.home) {
    return pathname === href;
  }

  if (href === routes.customer.dashboard) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminTitle(pathname: string): string {
  for (const section of adminNavSections) {
    for (const item of section.items) {
      if (isNavItemActive(pathname, item.href) && item.href !== routes.admin.home) {
        return item.label;
      }
    }
  }

  return "پنل مدیریت";
}
