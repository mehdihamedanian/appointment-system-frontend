import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_STAFF_ACTIVE_FILTERS,
  ADMIN_STAFF_BOOKABLE_FILTERS,
  ADMIN_STAFF_SORT_FIELDS,
  ADMIN_STAFF_VISIBILITY_FILTERS,
  type AdminStaffActiveFilter,
  type AdminStaffBookableFilter,
  type AdminStaffListFilters,
  type AdminStaffSortDirection,
  type AdminStaffSortField,
  type AdminStaffVisibilityFilter,
} from "@/types/admin-staff";

export function sanitizeStaffSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function sanitizeStaffFilterId(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || !isSafePublicId(raw)) return undefined;
  return raw;
}

export function parseAdminStaffPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminStaffActive(value: string | null | undefined): AdminStaffActiveFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_STAFF_ACTIVE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminStaffActiveFilter;
  }
  return "all";
}

export function parseAdminStaffVisibility(
  value: string | null | undefined,
): AdminStaffVisibilityFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_STAFF_VISIBILITY_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminStaffVisibilityFilter;
  }
  return "all";
}

export function parseAdminStaffBookable(
  value: string | null | undefined,
): AdminStaffBookableFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_STAFF_BOOKABLE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminStaffBookableFilter;
  }
  return "all";
}

export function parseAdminStaffSort(value: string | null | undefined): AdminStaffSortField {
  const raw = value?.trim() as AdminStaffSortField | undefined;
  if (raw && ADMIN_STAFF_SORT_FIELDS.includes(raw)) return raw;
  return "name";
}

export function parseAdminStaffDirection(
  value: string | null | undefined,
): AdminStaffSortDirection {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function parseAdminStaffFilters(search: {
  get(name: string): string | null;
}): AdminStaffListFilters {
  const filters: AdminStaffListFilters = {
    active: parseAdminStaffActive(search.get("active")),
    customerVisible: parseAdminStaffVisibility(search.get("visible")),
    bookable: parseAdminStaffBookable(search.get("bookable")),
    sort: parseAdminStaffSort(search.get("sort")),
    direction: parseAdminStaffDirection(search.get("direction")),
    page: parseAdminStaffPage(search.get("page")),
  };
  const q = sanitizeStaffSearch(search.get("q"));
  if (q) filters.q = q;
  const branchId = sanitizeStaffFilterId(search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const serviceId = sanitizeStaffFilterId(search.get("service"));
  if (serviceId) filters.serviceId = serviceId;
  const jobTitle = search.get("jobTitle")?.trim();
  if (jobTitle && jobTitle !== "all") filters.jobTitle = jobTitle.slice(0, 80);
  const specialty = search.get("specialty")?.trim();
  if (specialty && specialty !== "all") filters.specialty = specialty.slice(0, 80);
  return filters;
}

export function adminStaffFiltersApplied(filters: AdminStaffListFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.active !== "all" ||
    filters.customerVisible !== "all" ||
    filters.bookable !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.serviceId) ||
    Boolean(filters.jobTitle) ||
    Boolean(filters.specialty)
  );
}

export function countActiveAdminStaffFilters(filters: AdminStaffListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.active !== "all") count += 1;
  if (filters.customerVisible !== "all") count += 1;
  if (filters.bookable !== "all") count += 1;
  if (filters.branchId) count += 1;
  if (filters.serviceId) count += 1;
  if (filters.jobTitle) count += 1;
  if (filters.specialty) count += 1;
  return count;
}

export function adminStaffHref(input: Partial<AdminStaffListFilters> = {}): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.active && input.active !== "all") params.set("active", input.active);
  if (input.customerVisible && input.customerVisible !== "all") {
    params.set("visible", input.customerVisible);
  }
  if (input.bookable && input.bookable !== "all") params.set("bookable", input.bookable);
  if (input.branchId) params.set("branch", input.branchId);
  if (input.serviceId) params.set("service", input.serviceId);
  if (input.jobTitle) params.set("jobTitle", input.jobTitle);
  if (input.specialty) params.set("specialty", input.specialty);
  const sort = input.sort ?? "name";
  if (sort !== "name") params.set("sort", sort);
  const direction = input.direction ?? "asc";
  if (direction !== "asc") params.set("direction", direction);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `${routes.admin.staff}?${query}` : routes.admin.staff;
}

export function filtersToAdminStaffParams(
  filters: AdminStaffListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(filters.page),
    sort: filters.sort,
    direction: filters.direction,
  };
  if (filters.q) params.q = filters.q;
  if (filters.active !== "all") params.active = filters.active;
  if (filters.customerVisible !== "all") params.customerVisible = filters.customerVisible;
  if (filters.bookable !== "all") params.bookable = filters.bookable;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  if (filters.jobTitle) params.jobTitle = filters.jobTitle;
  if (filters.specialty) params.specialty = filters.specialty;
  return params;
}

export function adminStaffCalendarHref(staffId: string, date?: string): string {
  const params = new URLSearchParams();
  params.set("group", "staff");
  params.set("staff", staffId);
  if (date) params.set("date", date);
  return `${routes.admin.calendar}?${params.toString()}`;
}
