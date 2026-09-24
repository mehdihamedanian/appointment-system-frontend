import { todayIsoInTimeZone } from "@/lib/date-time/format";
import { routes } from "@/constants/routes";
import type { AdminDashboardFilters } from "@/types/admin-dashboard";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  if (!value || !ISO_DATE.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return value;
}

export function sanitizeBranchId(value: string | null | undefined): string | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function defaultOperationalDate(timezone?: string, now: Date = new Date()): string {
  return todayIsoInTimeZone(timezone, now);
}

export function parseAdminDashboardFilters(
  searchParams: URLSearchParams,
  timezone?: string,
  now: Date = new Date(),
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

export function filtersToQueryParams(filters: AdminDashboardFilters): Record<string, string> {
  const params: Record<string, string> = { date: filters.date };
  if (filters.analyticsFrom) {
    params.from = filters.analyticsFrom;
  }
  if (filters.analyticsTo) {
    params.to = filters.analyticsTo;
  }
  if (filters.branchId) {
    params.branchId = filters.branchId;
  }
  return params;
}

export function isManualBookingRouteEnabled(): boolean {
  return true;
}
