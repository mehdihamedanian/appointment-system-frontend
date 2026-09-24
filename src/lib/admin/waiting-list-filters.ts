import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS,
  ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS,
  ADMIN_WAITING_LIST_SORT_FIELDS,
  type AdminWaitingListEntryStatusFilter,
  type AdminWaitingListListFilters,
  type AdminWaitingListOfferStatusFilter,
  type AdminWaitingListSortDirection,
  type AdminWaitingListSortField,
} from "@/types/admin-waiting-list";

export function sanitizeWaitingListSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseAdminWaitingListPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminWaitingListEntryStatus(
  value: string | null | undefined,
): AdminWaitingListEntryStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminWaitingListEntryStatusFilter;
  }
  return "all";
}

export function parseAdminWaitingListOfferStatus(
  value: string | null | undefined,
): AdminWaitingListOfferStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminWaitingListOfferStatusFilter;
  }
  return "all";
}

export function parseAdminWaitingListSort(value: string | null | undefined): AdminWaitingListSortField {
  const raw = value?.trim() as AdminWaitingListSortField | undefined;
  if (raw && ADMIN_WAITING_LIST_SORT_FIELDS.includes(raw)) return raw;
  return "createdAt";
}

export function parseAdminWaitingListDirection(
  value: string | null | undefined,
): AdminWaitingListSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

function sanitizeReferenceFilter(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) return undefined;
  return raw;
}

export function parseAdminWaitingListFilters(search: {
  get(name: string): string | null;
}): AdminWaitingListListFilters {
  const filters: AdminWaitingListListFilters = {
    entryStatus: parseAdminWaitingListEntryStatus(search.get("entryStatus")),
    offerStatus: parseAdminWaitingListOfferStatus(search.get("offerStatus")),
    sort: parseAdminWaitingListSort(search.get("sort")),
    direction: parseAdminWaitingListDirection(search.get("direction")),
    page: parseAdminWaitingListPage(search.get("page")),
  };
  const q = sanitizeWaitingListSearch(search.get("q"));
  if (q) filters.q = q;
  const serviceId = sanitizeReferenceFilter(search.get("serviceId"));
  if (serviceId) filters.serviceId = serviceId;
  const providerId = sanitizeReferenceFilter(search.get("providerId"));
  if (providerId) filters.providerId = providerId;
  const branchId = sanitizeReferenceFilter(search.get("branchId"));
  if (branchId) filters.branchId = branchId;
  const preferredFrom = sanitizeIsoDate(search.get("preferredFrom"));
  if (preferredFrom) filters.preferredFrom = preferredFrom;
  const preferredTo = sanitizeIsoDate(search.get("preferredTo"));
  if (preferredTo) filters.preferredTo = preferredTo;
  const createdFrom = sanitizeIsoDate(search.get("createdFrom"));
  if (createdFrom) filters.createdFrom = createdFrom;
  const createdTo = sanitizeIsoDate(search.get("createdTo"));
  if (createdTo) filters.createdTo = createdTo;
  return filters;
}

export function adminWaitingListFiltersApplied(filters: AdminWaitingListListFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.entryStatus !== "all" ||
    filters.offerStatus !== "all" ||
    Boolean(filters.serviceId) ||
    Boolean(filters.providerId) ||
    Boolean(filters.branchId) ||
    Boolean(filters.preferredFrom) ||
    Boolean(filters.preferredTo) ||
    Boolean(filters.createdFrom) ||
    Boolean(filters.createdTo)
  );
}

export function countActiveAdminWaitingListFilters(filters: AdminWaitingListListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.entryStatus !== "all") count += 1;
  if (filters.offerStatus !== "all") count += 1;
  if (filters.serviceId) count += 1;
  if (filters.providerId) count += 1;
  if (filters.branchId) count += 1;
  if (filters.preferredFrom || filters.preferredTo) count += 1;
  if (filters.createdFrom || filters.createdTo) count += 1;
  return count;
}

export function adminWaitingListHref(input: Partial<AdminWaitingListListFilters> = {}): string {
  const filters: AdminWaitingListListFilters = {
    entryStatus: input.entryStatus ?? "all",
    offerStatus: input.offerStatus ?? "all",
    sort: input.sort ?? "createdAt",
    direction: input.direction ?? "desc",
    page: input.page ?? 1,
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.entryStatus !== "all") params.set("entryStatus", filters.entryStatus);
  if (filters.offerStatus !== "all") params.set("offerStatus", filters.offerStatus);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  if (filters.providerId) params.set("providerId", filters.providerId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.preferredFrom) params.set("preferredFrom", filters.preferredFrom);
  if (filters.preferredTo) params.set("preferredTo", filters.preferredTo);
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.waitingList}?${query}` : routes.admin.waitingList;
}

export function adminWaitingListDetailHref(reference: string): string {
  return routes.admin.waitingListDetail(reference);
}

export function adminWaitingListNewHref(): string {
  return routes.admin.waitingListNew;
}

export function adminWaitingListOfferHref(reference: string): string {
  return routes.admin.waitingListOffer(reference);
}

export function filtersToAdminWaitingListParams(
  filters: AdminWaitingListListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.entryStatus !== "all") params.entryStatus = filters.entryStatus;
  if (filters.offerStatus !== "all") params.offerStatus = filters.offerStatus;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  if (filters.providerId) params.providerId = filters.providerId;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.preferredFrom) params.preferredFrom = filters.preferredFrom;
  if (filters.preferredTo) params.preferredTo = filters.preferredTo;
  if (filters.createdFrom) params.createdFrom = filters.createdFrom;
  if (filters.createdTo) params.createdTo = filters.createdTo;
  if (filters.sort !== "createdAt") params.sort = filters.sort;
  if (filters.direction !== "desc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function waitingListPermission(
  action:
    | "view"
    | "create"
    | "contact"
    | "offer"
    | "lifecycle"
    | "notifications",
): string {
  switch (action) {
    case "view":
      return "admin.waiting_list.view";
    case "create":
      return "admin.waiting_list.create";
    case "contact":
      return "admin.waiting_list.view_contact";
    case "offer":
      return "admin.waiting_list.offer";
    case "lifecycle":
      return "admin.waiting_list.lifecycle";
    case "notifications":
      return "admin.waiting_list.notifications";
    default:
      return "admin.waiting_list.view";
  }
}
