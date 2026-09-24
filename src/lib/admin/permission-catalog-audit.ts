import type { AdminPermissionDomain } from "@/types/admin-access";

/**
 * Internal audit of Permission keys consumed by the admin frontend.
 * These are NOT invented production keys — they are keys already referenced
 * in navigation, PermissionGate, and feature helpers. Backend catalog must
 * align; mismatches are documented in BACKEND_DEPENDENCIES.md.
 */
export const FRONTEND_CONSUMED_PERMISSION_KEYS: ReadonlyArray<{
  key: string;
  domain: AdminPermissionDomain;
  source: string;
}> = [
  { key: "admin.dashboard.view", domain: "dashboard", source: "navigation" },
  { key: "admin.appointments.view", domain: "appointments", source: "navigation/screens" },
  { key: "admin.appointments.create", domain: "appointments", source: "manual-booking" },
  { key: "admin.appointments.edit_internal_note", domain: "appointments", source: "appointment-detail" },
  { key: "admin.calendar.view", domain: "calendar", source: "navigation" },
  { key: "admin.calendar.view_blocks", domain: "calendar", source: "calendar" },
  { key: "admin.customers.view", domain: "customers", source: "navigation" },
  { key: "admin.customers.view_contact", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.create", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.edit", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.edit_contact", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.notes", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.tags", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.payments.view", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.block", domain: "customers", source: "customer-filters" },
  { key: "admin.customers.deactivate", domain: "customers", source: "customer-filters" },
  { key: "admin.services.view", domain: "services", source: "navigation" },
  { key: "admin.services.create", domain: "services", source: "services" },
  { key: "admin.services.edit", domain: "services", source: "services" },
  { key: "admin.services.edit_content", domain: "services", source: "services" },
  { key: "admin.services.manage_pricing", domain: "services", source: "services" },
  { key: "admin.services.manage_providers", domain: "services", source: "services" },
  { key: "admin.services.manage_branches", domain: "services", source: "services" },
  { key: "admin.services.manage_resources", domain: "services", source: "services" },
  { key: "admin.staff.view", domain: "staff", source: "navigation" },
  { key: "admin.staff.create", domain: "staff", source: "staff" },
  { key: "admin.staff.edit", domain: "staff", source: "staff" },
  { key: "admin.staff.view_private_contact", domain: "staff", source: "staff" },
  { key: "admin.staff.view_performance", domain: "staff", source: "staff" },
  { key: "admin.resources.view", domain: "resources", source: "navigation" },
  { key: "admin.resources.create", domain: "resources", source: "resources" },
  { key: "admin.resources.edit", domain: "resources", source: "resources" },
  { key: "admin.branches.view", domain: "branches", source: "navigation" },
  { key: "admin.branches.create", domain: "branches", source: "branch-filters" },
  { key: "admin.branches.edit", domain: "branches", source: "branch-filters" },
  { key: "admin.branches.assign", domain: "branches", source: "branch-filters" },
  { key: "admin.branches.lifecycle", domain: "branches", source: "branch-filters" },
  { key: "admin.schedules.business.view", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.business.edit", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.branch.view", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.branch.edit", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.staff.view", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.staff.edit", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.resource.view", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.resource.edit", domain: "schedules", source: "schedule-filters" },
  { key: "admin.schedules.holidays.manage", domain: "schedules", source: "schedule-filters" },
  { key: "admin.payments.view", domain: "payments", source: "navigation" },
  { key: "admin.payments.revenue.view", domain: "payments", source: "payment-filters" },
  { key: "admin.payments.manual.record", domain: "payments", source: "payment-filters" },
  { key: "admin.payments.refund", domain: "payments", source: "payment-filters" },
  { key: "admin.payments.receipt", domain: "payments", source: "payment-filters" },
  { key: "admin.payments.financial.view", domain: "payments", source: "payment-filters" },
  { key: "admin.coupons.view", domain: "coupons", source: "navigation" },
  { key: "admin.coupons.create", domain: "coupons", source: "coupon-filters" },
  { key: "admin.coupons.edit", domain: "coupons", source: "coupon-filters" },
  { key: "admin.coupons.lifecycle", domain: "coupons", source: "coupon-filters" },
  { key: "admin.waiting_list.view", domain: "waiting_list", source: "navigation" },
  { key: "admin.waiting_list.create", domain: "waiting_list", source: "waiting-list-filters" },
  { key: "admin.waiting_list.view_contact", domain: "waiting_list", source: "waiting-list-filters" },
  { key: "admin.waiting_list.offer", domain: "waiting_list", source: "waiting-list-filters" },
  { key: "admin.waiting_list.lifecycle", domain: "waiting_list", source: "waiting-list-filters" },
  { key: "admin.waiting_list.notifications", domain: "waiting_list", source: "waiting-list-filters" },
  { key: "admin.notifications.view", domain: "notifications", source: "navigation" },
  { key: "admin.notifications.templates.view", domain: "notifications", source: "notification-filters" },
  { key: "admin.notifications.templates.edit", domain: "notifications", source: "notification-filters" },
  { key: "admin.notifications.templates.toggle", domain: "notifications", source: "notification-filters" },
  { key: "admin.notifications.logs.view", domain: "notifications", source: "notification-filters" },
  { key: "admin.notifications.logs.retry", domain: "notifications", source: "notification-filters" },
  { key: "admin.notifications.logs.view_sensitive", domain: "notifications", source: "notification-filters" },
  { key: "admin.reports.view", domain: "reports", source: "navigation" },
  { key: "admin.reports.export", domain: "reports", source: "report-filters" },
  { key: "admin.reports.revenue.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.bookings.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.customers.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.services.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.staff.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.resources.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.branches.view", domain: "reports", source: "report-filters" },
  { key: "admin.reports.peak.view", domain: "reports", source: "report-filters" },
  { key: "admin.users.view", domain: "users", source: "navigation" },
  { key: "admin.roles.view", domain: "roles", source: "navigation" },
  { key: "admin.settings.view", domain: "settings", source: "navigation" },
  { key: "admin.settings.general.view", domain: "settings", source: "settings-section" },
  { key: "admin.settings.general.edit", domain: "settings", source: "settings-section" },
  {
    key: "admin.settings.localization.view",
    domain: "settings",
    source: "settings-section",
  },
  {
    key: "admin.settings.localization.edit",
    domain: "settings",
    source: "settings-section",
  },
  { key: "admin.settings.booking.view", domain: "settings", source: "settings-section" },
  { key: "admin.settings.booking.edit", domain: "settings", source: "settings-section" },
  { key: "admin.settings.payments.view", domain: "settings", source: "settings-section" },
  { key: "admin.settings.payments.edit", domain: "settings", source: "settings-section" },
  {
    key: "admin.settings.notifications.view",
    domain: "settings",
    source: "settings-section",
  },
  {
    key: "admin.settings.notifications.edit",
    domain: "settings",
    source: "settings-section",
  },
  { key: "admin.activity_logs.view", domain: "activity_logs", source: "navigation" },
  {
    key: "admin.activity_logs.view_detail",
    domain: "activity_logs",
    source: "activity-logs",
  },
  {
    key: "admin.activity_logs.view_changes",
    domain: "activity_logs",
    source: "activity-logs",
  },
  {
    key: "admin.activity_logs.view_private",
    domain: "activity_logs",
    source: "activity-logs",
  },
  {
    key: "admin.activity_logs.view_security",
    domain: "activity_logs",
    source: "activity-logs",
  },
  { key: "admin.activity_logs.export", domain: "activity_logs", source: "activity-logs" },
];

/** Phase 40 module permission keys expected from Backend (UI contract). */
export const PHASE40_EXPECTED_PERMISSION_KEYS = [
  "admin.users.view",
  "admin.users.create",
  "admin.users.edit",
  "admin.users.deactivate",
  "admin.users.assign_role",
  "admin.users.link_staff",
  "admin.roles.view",
  "admin.roles.create",
  "admin.roles.edit",
  "admin.roles.delete",
  "admin.roles.assign_permissions",
] as const;

export function inferPermissionDomain(key: string): AdminPermissionDomain {
  const raw = key.toLowerCase();
  if (raw.includes(".dashboard.")) return "dashboard";
  if (raw.includes(".appointments.")) return "appointments";
  if (raw.includes(".calendar.")) return "calendar";
  if (raw.includes(".customers.")) return "customers";
  if (raw.includes(".services.")) return "services";
  if (raw.includes(".staff.")) return "staff";
  if (raw.includes(".resources.")) return "resources";
  if (raw.includes(".schedules.")) return "schedules";
  if (raw.includes(".branches.")) return "branches";
  if (raw.includes(".payments.")) return "payments";
  if (raw.includes(".coupons.")) return "coupons";
  if (raw.includes(".waiting_list.")) return "waiting_list";
  if (raw.includes(".notifications.")) return "notifications";
  if (raw.includes(".reports.")) return "reports";
  if (raw.includes(".users.")) return "users";
  if (raw.includes(".roles.")) return "roles";
  if (raw.includes(".settings.")) return "settings";
  if (raw.includes(".activity_logs.") || raw.includes(".activity-logs.")) return "activity_logs";
  return "other";
}

export function diffPermissionSets(
  previous: readonly string[],
  next: readonly string[],
): { granted: string[]; revoked: string[]; unchanged: string[] } {
  const prev = new Set(previous);
  const nxt = new Set(next);
  const granted: string[] = [];
  const revoked: string[] = [];
  const unchanged: string[] = [];
  for (const key of nxt) {
    if (prev.has(key)) unchanged.push(key);
    else granted.push(key);
  }
  for (const key of prev) {
    if (!nxt.has(key)) revoked.push(key);
  }
  return { granted, revoked, unchanged };
}

/**
 * Compare Backend catalog keys with frontend-consumed keys.
 * Does not rename or invent keys — reports gaps only.
 */
export function auditPermissionCatalogCoverage(backendKeys: readonly string[]): {
  frontendOnly: string[];
  backendOnly: string[];
  shared: string[];
} {
  const backend = new Set(backendKeys);
  const frontend = new Set(FRONTEND_CONSUMED_PERMISSION_KEYS.map((item) => item.key));
  const frontendOnly = [...frontend].filter((key) => !backend.has(key)).sort();
  const backendOnly = [...backend].filter((key) => !frontend.has(key)).sort();
  const shared = [...frontend].filter((key) => backend.has(key)).sort();
  return { frontendOnly, backendOnly, shared };
}
