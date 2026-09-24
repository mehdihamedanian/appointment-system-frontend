import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_CUSTOMER_ACTIVE_FILTERS,
  ADMIN_CUSTOMER_SORT_FIELDS,
  ADMIN_CUSTOMER_UPCOMING_FILTERS,
  type AdminCustomerActiveFilter,
  type AdminCustomerListFilters,
  type AdminCustomerSortDirection,
  type AdminCustomerSortField,
  type AdminCustomerUpcomingFilter,
} from "@/types/admin-customer";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeCustomerSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseAdminCustomerPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminCustomerActive(value: string | null | undefined): AdminCustomerActiveFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_CUSTOMER_ACTIVE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminCustomerActiveFilter;
  }
  return "all";
}

export function parseAdminCustomerUpcoming(value: string | null | undefined): AdminCustomerUpcomingFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_CUSTOMER_UPCOMING_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminCustomerUpcomingFilter;
  }
  return "all";
}

export function parseAdminCustomerSort(value: string | null | undefined): AdminCustomerSortField {
  const raw = value?.trim() as AdminCustomerSortField | undefined;
  if (raw && ADMIN_CUSTOMER_SORT_FIELDS.includes(raw)) return raw;
  return "name";
}

export function parseAdminCustomerDirection(value: string | null | undefined): AdminCustomerSortDirection {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

export function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !ISO_DATE.test(raw)) return undefined;
  return raw;
}

export function sanitizeFilterId(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || !isSafePublicId(raw)) return undefined;
  return raw;
}

export function parseAdminCustomerFilters(search: {
  get(name: string): string | null;
}): AdminCustomerListFilters {
  const filters: AdminCustomerListFilters = {
    active: parseAdminCustomerActive(search.get("active")),
    upcoming: parseAdminCustomerUpcoming(search.get("upcoming")),
    sort: parseAdminCustomerSort(search.get("sort")),
    direction: parseAdminCustomerDirection(search.get("direction")),
    page: parseAdminCustomerPage(search.get("page")),
  };
  const q = sanitizeCustomerSearch(search.get("q"));
  if (q) filters.q = q;
  const lastVisitFrom = sanitizeIsoDate(search.get("lastVisitFrom"));
  const lastVisitTo = sanitizeIsoDate(search.get("lastVisitTo"));
  if (lastVisitFrom) filters.lastVisitFrom = lastVisitFrom;
  if (lastVisitTo) filters.lastVisitTo = lastVisitTo;
  const serviceId = sanitizeFilterId(search.get("serviceId"));
  const branchId = sanitizeFilterId(search.get("branchId"));
  const tagId = sanitizeFilterId(search.get("tagId"));
  if (serviceId) filters.serviceId = serviceId;
  if (branchId) filters.branchId = branchId;
  if (tagId) filters.tagId = tagId;
  return filters;
}

export function adminCustomerFiltersApplied(filters: AdminCustomerListFilters): boolean {
  return Boolean(
    filters.q ||
      filters.active !== "all" ||
      filters.upcoming !== "all" ||
      filters.lastVisitFrom ||
      filters.lastVisitTo ||
      filters.serviceId ||
      filters.branchId ||
      filters.tagId,
  );
}

export function countActiveAdminCustomerFilters(filters: AdminCustomerListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.active !== "all") count += 1;
  if (filters.upcoming !== "all") count += 1;
  if (filters.lastVisitFrom || filters.lastVisitTo) count += 1;
  if (filters.serviceId) count += 1;
  if (filters.branchId) count += 1;
  if (filters.tagId) count += 1;
  return count;
}

export function adminCustomerHref(filters: AdminCustomerListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.active !== "all") params.set("active", filters.active);
  if (filters.upcoming !== "all") params.set("upcoming", filters.upcoming);
  if (filters.lastVisitFrom) params.set("lastVisitFrom", filters.lastVisitFrom);
  if (filters.lastVisitTo) params.set("lastVisitTo", filters.lastVisitTo);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.tagId) params.set("tagId", filters.tagId);
  if (filters.sort !== "name") params.set("sort", filters.sort);
  if (filters.direction !== "asc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.customers}?${query}` : routes.admin.customers;
}

export function filtersToAdminCustomerParams(filters: AdminCustomerListFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.active !== "all") params.active = filters.active;
  if (filters.upcoming !== "all") params.upcoming = filters.upcoming;
  if (filters.lastVisitFrom) params.lastVisitFrom = filters.lastVisitFrom;
  if (filters.lastVisitTo) params.lastVisitTo = filters.lastVisitTo;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.tagId) params.tagId = filters.tagId;
  if (filters.sort !== "name") params.sort = filters.sort;
  if (filters.direction !== "asc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function adminCustomerDetailHref(reference: string): string {
  return routes.admin.customerDetail(reference);
}

export function adminCustomerEditHref(reference: string): string {
  return routes.admin.customerEdit(reference);
}

export function adminCustomerNewHref(): string {
  return routes.admin.customerNew;
}

export function customerPermission(
  action:
    | "view"
    | "view_contact"
    | "create"
    | "edit"
    | "edit_contact"
    | "notes"
    | "tags"
    | "payments"
    | "block"
    | "deactivate",
): string {
  switch (action) {
    case "view":
      return "admin.customers.view";
    case "view_contact":
      return "admin.customers.view_contact";
    case "create":
      return "admin.customers.create";
    case "edit":
      return "admin.customers.edit";
    case "edit_contact":
      return "admin.customers.edit_contact";
    case "notes":
      return "admin.customers.notes";
    case "tags":
      return "admin.customers.tags";
    case "payments":
      return "admin.customers.payments.view";
    case "block":
      return "admin.customers.block";
    case "deactivate":
      return "admin.customers.deactivate";
  }
}
