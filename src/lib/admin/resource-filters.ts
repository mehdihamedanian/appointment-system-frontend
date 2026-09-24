import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_RESOURCE_ACTIVE_FILTERS,
  ADMIN_RESOURCE_SORT_FIELDS,
  type AdminResourceActiveFilter,
  type AdminResourceListFilters,
  type AdminResourceSortDirection,
  type AdminResourceSortField,
} from "@/types/admin-resource";

export function sanitizeResourceSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function sanitizeResourceFilterId(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || !isSafePublicId(raw)) return undefined;
  return raw;
}

export function parseAdminResourcePage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminResourceActive(
  value: string | null | undefined,
): AdminResourceActiveFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_RESOURCE_ACTIVE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminResourceActiveFilter;
  }
  return "all";
}

export function parseAdminResourceSort(value: string | null | undefined): AdminResourceSortField {
  const raw = value?.trim() as AdminResourceSortField | undefined;
  if (raw && ADMIN_RESOURCE_SORT_FIELDS.includes(raw)) return raw;
  return "name";
}

export function parseAdminResourceDirection(
  value: string | null | undefined,
): AdminResourceSortDirection {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function parseAdminResourceFilters(search: {
  get(name: string): string | null;
}): AdminResourceListFilters {
  const filters: AdminResourceListFilters = {
    type: search.get("type")?.trim() || "all",
    active: parseAdminResourceActive(search.get("active")),
    sort: parseAdminResourceSort(search.get("sort")),
    direction: parseAdminResourceDirection(search.get("direction")),
    page: parseAdminResourcePage(search.get("page")),
  };
  const q = sanitizeResourceSearch(search.get("q"));
  if (q) filters.q = q;
  const branchId = sanitizeResourceFilterId(search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const serviceId = sanitizeResourceFilterId(search.get("service"));
  if (serviceId) filters.serviceId = serviceId;
  if (filters.type !== "all" && filters.type.length > 40) {
    filters.type = "all";
  }
  return filters;
}

export function adminResourceFiltersApplied(filters: AdminResourceListFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.type !== "all" ||
    filters.active !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.serviceId)
  );
}

export function countActiveAdminResourceFilters(filters: AdminResourceListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.type !== "all") count += 1;
  if (filters.active !== "all") count += 1;
  if (filters.branchId) count += 1;
  if (filters.serviceId) count += 1;
  return count;
}

export function adminResourcesHref(input: Partial<AdminResourceListFilters> = {}): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.active && input.active !== "all") params.set("active", input.active);
  if (input.branchId) params.set("branch", input.branchId);
  if (input.serviceId) params.set("service", input.serviceId);
  const sort = input.sort ?? "name";
  if (sort !== "name") params.set("sort", sort);
  const direction = input.direction ?? "asc";
  if (direction !== "asc") params.set("direction", direction);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `${routes.admin.resources}?${query}` : routes.admin.resources;
}

export function filtersToAdminResourceParams(
  filters: AdminResourceListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(filters.page),
    sort: filters.sort,
    direction: filters.direction,
  };
  if (filters.q) params.q = filters.q;
  if (filters.type !== "all") params.type = filters.type;
  if (filters.active !== "all") params.active = filters.active;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  return params;
}

export function adminResourceCalendarHref(resourceId: string, date?: string): string {
  const params = new URLSearchParams();
  params.set("group", "resource");
  params.set("resource", resourceId);
  if (date) params.set("date", date);
  return `${routes.admin.calendar}?${params.toString()}`;
}
