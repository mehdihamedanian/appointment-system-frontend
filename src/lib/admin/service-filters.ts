import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_SERVICE_ACTIVE_FILTERS,
  ADMIN_SERVICE_SORT_FIELDS,
  type AdminServiceActiveFilter,
  type AdminServiceListFilters,
  type AdminServiceSortDirection,
  type AdminServiceSortField,
} from "@/types/admin-service";

export function sanitizeServiceSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 120);
}

export function sanitizeServiceFilterId(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || !isSafePublicId(raw)) return undefined;
  return raw;
}

export function parseAdminServicePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminServiceActive(value: string | null | undefined): AdminServiceActiveFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_SERVICE_ACTIVE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminServiceActiveFilter;
  }
  return "all";
}

export function parseAdminServiceSort(value: string | null | undefined): AdminServiceSortField {
  const raw = value?.trim() as AdminServiceSortField | undefined;
  if (raw && ADMIN_SERVICE_SORT_FIELDS.includes(raw)) return raw;
  return "sortOrder";
}

export function parseAdminServiceDirection(
  value: string | null | undefined,
): AdminServiceSortDirection {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function parseAdminServiceFilters(search: {
  get(name: string): string | null;
}): AdminServiceListFilters {
  const filters: AdminServiceListFilters = {
    active: parseAdminServiceActive(search.get("active")),
    sort: parseAdminServiceSort(search.get("sort")),
    direction: parseAdminServiceDirection(search.get("direction")),
    page: parseAdminServicePage(search.get("page")),
  };
  const q = sanitizeServiceSearch(search.get("q"));
  if (q) filters.q = q;
  const branchId = sanitizeServiceFilterId(search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const providerId = sanitizeServiceFilterId(search.get("provider"));
  if (providerId) filters.providerId = providerId;
  const resourceType = search.get("resourceType")?.trim();
  if (resourceType && resourceType !== "all") filters.resourceType = resourceType.slice(0, 40);
  return filters;
}

export function adminServiceFiltersApplied(filters: AdminServiceListFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.active !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.providerId) ||
    Boolean(filters.resourceType)
  );
}

export function countActiveAdminServiceFilters(filters: AdminServiceListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.active !== "all") count += 1;
  if (filters.branchId) count += 1;
  if (filters.providerId) count += 1;
  if (filters.resourceType) count += 1;
  return count;
}

export function adminServiceHref(input: Partial<AdminServiceListFilters> = {}): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.active && input.active !== "all") params.set("active", input.active);
  if (input.branchId) params.set("branch", input.branchId);
  if (input.providerId) params.set("provider", input.providerId);
  if (input.resourceType) params.set("resourceType", input.resourceType);
  const sort = input.sort ?? "sortOrder";
  if (sort !== "sortOrder") params.set("sort", sort);
  const direction = input.direction ?? "asc";
  if (direction !== "asc") params.set("direction", direction);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `${routes.admin.services}?${query}` : routes.admin.services;
}

export function filtersToAdminServiceParams(
  filters: AdminServiceListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(filters.page),
    sort: filters.sort,
    direction: filters.direction,
  };
  if (filters.q) params.q = filters.q;
  if (filters.active !== "all") params.active = filters.active;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.providerId) params.providerId = filters.providerId;
  if (filters.resourceType) params.resourceType = filters.resourceType;
  return params;
}
