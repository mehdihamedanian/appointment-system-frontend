import { todayIsoInTimeZone } from "@/lib/date-time/format";
import { serverNow } from "@/lib/date-time/server-clock";
import { addDaysToIsoDate, isIsoDate } from "@/lib/date-time/zoned";
import { routes } from "@/constants/routes";
import type { AdminDashboardFilters } from "@/types/admin-dashboard";

export function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  return isIsoDate(value) ? value : undefined;
}

export function sanitizeBranchId(value: string | null | undefined): string | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function defaultOperationalDate(timezone?: string, now: Date = serverNow()): string {
  return todayIsoInTimeZone(timezone, now);
}

export function parseAdminDashboardFilters(
  searchParams: URLSearchParams,
  timezone?: string,
  now: Date = serverNow(),
): AdminDashboardFilters {
  const date =
    sanitizeIsoDate(searchParams.get("date")) ?? defaultOperationalDate(timezone, now);
  const analyticsFrom = sanitizeIsoDate(searchParams.get("from"));
  const analyticsTo = sanitizeIsoDate(searchParams.get("to"));
  const branchId = sanitizeBranchId(searchParams.get("branch"));

  return {
    date,
    analyticsFrom,
    analyticsTo,
    branchId,
  };
}

export function adminDashboardHref(filters: AdminDashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.date) {
    params.set("date", filters.date);
  }
  if (filters.analyticsFrom) {
    params.set("from", filters.analyticsFrom);
  }
  if (filters.analyticsTo) {
    params.set("to", filters.analyticsTo);
  }
  if (filters.branchId) {
    params.set("branch", filters.branchId);
  }
  const query = params.toString();
  return query ? `${routes.admin.home}?${query}` : routes.admin.home;
}

export function addIsoDays(value: string, days: number): string {
  return addDaysToIsoDate(value, days);
}

/** `/admin/dashboard/summary` uses an inclusive `start_date` and exclusive `end_date`. */
export function operationalDayQueryParams(
  filters: AdminDashboardFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    start_date: filters.date,
    end_date: addIsoDays(filters.date, 1),
  };
  if (filters.branchId) {
    params.branch_id = filters.branchId;
  }
  return params;
}

/** Without an explicit range the Backend applies its default reporting period. */
export function analyticsRangeQueryParams(
  filters: AdminDashboardFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.analyticsFrom && filters.analyticsTo && filters.analyticsFrom <= filters.analyticsTo) {
    params.start_date = filters.analyticsFrom;
    params.end_date = addIsoDays(filters.analyticsTo, 1);
  }
  if (filters.branchId) {
    params.branch_id = filters.branchId;
  }
  return params;
}

export function isManualBookingRouteEnabled(): boolean {
  return true;
}
