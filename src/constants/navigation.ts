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
  /** Opaque Backend permission code; omit when any admin with panel access may see it. */
  permission?: string;
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
  {
    href: routes.customer.waitingList,
    label: "لیست انتظار",
    icon: "waitingList",
    capability: "waitingList",
  },
];

/**
 * Admin navigation — only routes that exist under `/admin/*`.
 * Permission codes stay opaque placeholders until Backend documents them.
 */
export const adminNavSections: NavSection[] = [
  {
    id: "daily-operations",
    label: "عملیات روزانه",
    items: [
      {
        href: routes.admin.home,
        label: "نمای کلی",
        icon: "overview",
        permission: "admin.dashboard.view",
      },
      {
        href: routes.admin.manualBooking,
        label: "ثبت نوبت",
        icon: "booking",
        permission: "admin.appointments.create",
      },
      {
        href: routes.admin.appointments,
        label: "نوبت‌ها",
        icon: "appointments",
        permission: "admin.appointments.view",
      },
      {
        href: routes.admin.calendar,
        label: "تقویم",
        icon: "calendar",
        permission: "admin.calendar.view",
      },
      {
        href: routes.admin.waitingList,
        label: "لیست انتظار",
        icon: "waitingList",
        capability: "waitingList",
        permission: "admin.waiting_list.view",
      },
    ],
  },
  {
    id: "business-management",
    label: "مدیریت کسب‌وکار",
    items: [
      {
        href: routes.admin.customers,
        label: "مشتریان",
        icon: "customers",
        permission: "admin.customers.view",
      },
      {
        href: routes.admin.services,
        label: "خدمات",
        icon: "services",
        permission: "admin.services.view",
      },
      {
        href: routes.admin.staff,
        label: "کارکنان",
        icon: "staff",
        permission: "admin.staff.view",
      },
      {
        href: routes.admin.resources,
        label: "منابع",
        icon: "resources",
        permission: "admin.resources.view",
      },
      {
        href: routes.admin.branches,
        label: "شعب",
        icon: "branches",
        capability: "multipleBranches",
        permission: "admin.branches.view",
      },
      {
        href: routes.admin.schedules,
        label: "زمان‌بندی",
        icon: "calendar",
        permission: "admin.schedules.business.view",
      },
    ],
  },
  {
    id: "finance-analytics",
    label: "مالی و گزارش",
    items: [
      {
        href: routes.admin.payments,
        label: "پرداخت‌ها",
        icon: "payments",
        capability: "onlinePayments",
        permission: "admin.payments.view",
      },
      {
        href: routes.admin.coupons,
        label: "کوپن‌ها",
        icon: "wallet",
        capability: "coupons",
        permission: "admin.coupons.view",
      },
      {
        href: routes.admin.reports,
        label: "گزارش‌ها",
        icon: "reports",
        permission: "admin.reports.view",
      },
    ],
  },
  {
    id: "system",
    label: "سامانه",
    items: [
      {
        href: routes.admin.notifications,
        label: "اعلان‌ها",
        icon: "bell",
        permission: "admin.notifications.view",
      },
      {
        href: routes.admin.users,
        label: "کاربران",
        icon: "users",
        permission: "admin.users.view",
      },
      {
        href: routes.admin.roles,
        label: "نقش‌ها",
        icon: "roles",
        permission: "admin.roles.view",
      },
      {
        href: routes.admin.settings,
        label: "تنظیمات",
        icon: "settings",
        permission: "admin.settings.view",
      },
      {
        href: routes.admin.activityLogs,
        label: "رویدادها",
        icon: "activity",
        permission: "admin.activity_logs.view",
      },
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
