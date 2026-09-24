import { sanitizeIsoDate, sanitizeBranchId } from "@/lib/admin/dashboard-filters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import type {
  AdminActivityLogListFilters,
  AdminActivityLogResultFilter,
  AdminActivityLogSortDirection,
  AdminActivityLogSortField,
} from "@/types/admin-activity-log";
import {
  ADMIN_ACTIVITY_LOG_RESULT_FILTERS,
  ADMIN_ACTIVITY_LOG_SORT_FIELDS,
} from "@/types/admin-activity-log";

export function activityLogPermission(
  action:
    | "view"
    | "viewDetail"
    | "viewChanges"
    | "viewPrivate"
    | "viewSecurity"
    | "export",
): string {
  switch (action) {
    case "view":
      return "admin.activity_logs.view";
    case "viewDetail":
      return "admin.activity_logs.view_detail";
    case "viewChanges":
      return "admin.activity_logs.view_changes";
    case "viewPrivate":
      return "admin.activity_logs.view_private";
    case "viewSecurity":
      return "admin.activity_logs.view_security";
    case "export":
      return "admin.activity_logs.export";
    default:
      return "admin.activity_logs.view";
  }
}

export const PHASE42_EXPECTED_PERMISSION_KEYS = [
  "admin.activity_logs.view",
  "admin.activity_logs.view_detail",
  "admin.activity_logs.view_changes",
  "admin.activity_logs.view_private",
  "admin.activity_logs.view_security",
  "admin.activity_logs.export",
] as const;

export function sanitizeActivityLogSearch(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 120);
}

function parsePage(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseDirection(value: string | null | undefined): AdminActivityLogSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

export function parseAdminActivityLogSort(
  value: string | null | undefined,
): AdminActivityLogSortField {
  const raw = value?.trim() as AdminActivityLogSortField | undefined;
  if (raw && (ADMIN_ACTIVITY_LOG_SORT_FIELDS as readonly string[]).includes(raw)) {
    return raw;
  }
  return "occurredAt";
}

export function parseAdminActivityLogResultFilter(
  value: string | null | undefined,
): AdminActivityLogResultFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_ACTIVITY_LOG_RESULT_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminActivityLogResultFilter;
  }
  return "all";
}

function sanitizeFilterCode(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all") return undefined;
  if (!/^[A-Za-z0-9_./:-]{1,80}$/.test(raw)) return undefined;
  return raw;
}

function sanitizeActorReference(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all") return undefined;
  if (!isSafePublicId(raw) && !/^[A-Za-z0-9_.-]{1,80}$/.test(raw)) return undefined;
  return raw;
}

export function defaultAdminActivityLogFilters(): AdminActivityLogListFilters {
  return {
    action: "all",
    entityType: "all",
    result: "all",
    sort: "occurredAt",
    direction: "desc",
    page: 1,
  };
}

export function parseAdminActivityLogFilters(search: {
  get(name: string): string | null;
}): AdminActivityLogListFilters {
  const filters: AdminActivityLogListFilters = {
    action: sanitizeFilterCode(search.get("action")) ?? "all",
    entityType: sanitizeFilterCode(search.get("entityType")) ?? "all",
    result: parseAdminActivityLogResultFilter(search.get("result")),
    sort: parseAdminActivityLogSort(search.get("sort")),
    direction: parseDirection(search.get("direction")),
    page: parsePage(search.get("page")),
  };
  const q = sanitizeActivityLogSearch(search.get("q"));
  if (q) filters.q = q;
  const actorReference = sanitizeActorReference(
    search.get("actor") ?? search.get("actorReference"),
  );
  if (actorReference) filters.actorReference = actorReference;
  const branchId = sanitizeBranchId(search.get("branchId") ?? search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  return filters;
}

export function adminActivityLogFiltersApplied(
  filters: AdminActivityLogListFilters,
): boolean {
  return (
    Boolean(filters.q) ||
    Boolean(filters.actorReference) ||
    filters.action !== "all" ||
    filters.entityType !== "all" ||
    filters.result !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

export function countActiveAdminActivityLogFilters(
  filters: AdminActivityLogListFilters,
): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.actorReference) count += 1;
  if (filters.action !== "all") count += 1;
  if (filters.entityType !== "all") count += 1;
  if (filters.result !== "all") count += 1;
  if (filters.branchId) count += 1;
  if (filters.from || filters.to) count += 1;
  return count;
}

export function adminActivityLogsHref(
  input: Partial<AdminActivityLogListFilters> = {},
): string {
  const filters: AdminActivityLogListFilters = {
    ...defaultAdminActivityLogFilters(),
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.actorReference) params.set("actor", filters.actorReference);
  if (filters.action !== "all") params.set("action", filters.action);
  if (filters.entityType !== "all") params.set("entityType", filters.entityType);
  if (filters.result !== "all") params.set("result", filters.result);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== "occurredAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `${routes.admin.activityLogs}?${qs}` : routes.admin.activityLogs;
}

export function adminActivityLogDetailHref(reference: string): string {
  return routes.admin.activityLogDetail(reference);
}

export function filtersToAdminActivityLogParams(
  filters: AdminActivityLogListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    sort: filters.sort,
    direction: filters.direction,
    page: String(filters.page),
  };
  if (filters.q) params.q = filters.q;
  if (filters.actorReference) params.actor = filters.actorReference;
  if (filters.action !== "all") params.action = filters.action;
  if (filters.entityType !== "all") params.entityType = filters.entityType;
  if (filters.result !== "all") params.result = filters.result;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
}
