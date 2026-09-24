import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_BRANCH_ACTIVE_FILTERS,
  ADMIN_BRANCH_SORT_FIELDS,
  type AdminBranchActiveFilter,
  type AdminBranchListFilters,
  type AdminBranchSortDirection,
  type AdminBranchSortField,
} from "@/types/admin-branch";

export function sanitizeBranchSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseAdminBranchPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminBranchActive(value: string | null | undefined): AdminBranchActiveFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_BRANCH_ACTIVE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminBranchActiveFilter;
  }
  return "all";
}

export function parseAdminBranchSort(value: string | null | undefined): AdminBranchSortField {
  const raw = value?.trim() as AdminBranchSortField | undefined;
  if (raw && ADMIN_BRANCH_SORT_FIELDS.includes(raw)) return raw;
  return "name";
}

export function parseAdminBranchDirection(value: string | null | undefined): AdminBranchSortDirection {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function parseAdminBranchFilters(search: {
  get(name: string): string | null;
}): AdminBranchListFilters {
  const filters: AdminBranchListFilters = {
    active: parseAdminBranchActive(search.get("active")),
    sort: parseAdminBranchSort(search.get("sort")),
    direction: parseAdminBranchDirection(search.get("direction")),
    page: parseAdminBranchPage(search.get("page")),
  };
  const q = sanitizeBranchSearch(search.get("q"));
  if (q) filters.q = q;
  return filters;
}

export function adminBranchFiltersApplied(filters: AdminBranchListFilters): boolean {
  return Boolean(filters.q) || filters.active !== "all";
}

export function countActiveAdminBranchFilters(filters: AdminBranchListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.active !== "all") count += 1;
  return count;
}

export function adminBranchHref(filters: AdminBranchListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.active !== "all") params.set("active", filters.active);
  if (filters.sort !== "name") params.set("sort", filters.sort);
  if (filters.direction !== "asc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.branches}?${query}` : routes.admin.branches;
}

export function filtersToAdminBranchParams(filters: AdminBranchListFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.active !== "all") params.active = filters.active;
  if (filters.sort !== "name") params.sort = filters.sort;
  if (filters.direction !== "asc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function adminBranchDetailHref(reference: string): string {
  return routes.admin.branchDetail(reference);
}

export function adminBranchEditHref(reference: string): string {
  return routes.admin.branchEdit(reference);
}

export function adminBranchNewHref(): string {
  return routes.admin.branchNew;
}

export function adminBranchCalendarHref(reference: string, date?: string): string {
  const params = new URLSearchParams();
  params.set("branch", reference);
  params.set("group", "branch");
  if (date) params.set("date", date);
  return `${routes.admin.calendar}?${params.toString()}`;
}

export function adminBranchScheduleHref(reference: string): string {
  return routes.admin.branchSchedule(reference);
}

export { adminScheduleBranchHref } from "@/lib/admin/schedule-filters";

export function branchPermission(action: "view" | "create" | "edit" | "assign" | "lifecycle"): string {
  switch (action) {
    case "view":
      return "admin.branches.view";
    case "create":
      return "admin.branches.create";
    case "edit":
      return "admin.branches.edit";
    case "assign":
      return "admin.branches.assign";
    case "lifecycle":
      return "admin.branches.lifecycle";
  }
}

export function sanitizeBranchReference(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed && isSafePublicId(trimmed) ? trimmed : undefined;
}
