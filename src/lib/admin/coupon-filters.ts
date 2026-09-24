import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_COUPON_DISCOUNT_TYPE_FILTERS,
  ADMIN_COUPON_SORT_FIELDS,
  ADMIN_COUPON_STATUS_FILTERS,
  ADMIN_COUPON_VALIDITY_FILTERS,
  type AdminCouponDiscountTypeFilter,
  type AdminCouponListFilters,
  type AdminCouponSortDirection,
  type AdminCouponSortField,
  type AdminCouponStatusFilter,
  type AdminCouponValidityFilter,
} from "@/types/admin-coupon";

export function sanitizeCouponSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseAdminCouponPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminCouponStatus(value: string | null | undefined): AdminCouponStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_COUPON_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminCouponStatusFilter;
  }
  return "all";
}

export function parseAdminCouponDiscountType(
  value: string | null | undefined,
): AdminCouponDiscountTypeFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_COUPON_DISCOUNT_TYPE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminCouponDiscountTypeFilter;
  }
  return "all";
}

export function parseAdminCouponValidity(
  value: string | null | undefined,
): AdminCouponValidityFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_COUPON_VALIDITY_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminCouponValidityFilter;
  }
  return "all";
}

export function parseAdminCouponSort(value: string | null | undefined): AdminCouponSortField {
  const raw = value?.trim() as AdminCouponSortField | undefined;
  if (raw && ADMIN_COUPON_SORT_FIELDS.includes(raw)) return raw;
  return "updatedAt";
}

export function parseAdminCouponDirection(
  value: string | null | undefined,
): AdminCouponSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function sanitizeReferenceFilter(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) return undefined;
  return raw;
}

export function parseAdminCouponFilters(search: {
  get(name: string): string | null;
}): AdminCouponListFilters {
  const filters: AdminCouponListFilters = {
    status: parseAdminCouponStatus(search.get("status")),
    discountType: parseAdminCouponDiscountType(search.get("discountType")),
    validity: parseAdminCouponValidity(search.get("validity")),
    sort: parseAdminCouponSort(search.get("sort")),
    direction: parseAdminCouponDirection(search.get("direction")),
    page: parseAdminCouponPage(search.get("page")),
  };
  const q = sanitizeCouponSearch(search.get("q"));
  if (q) filters.q = q;
  const serviceId = sanitizeReferenceFilter(search.get("serviceId"));
  if (serviceId) filters.serviceId = serviceId;
  const branchId = sanitizeReferenceFilter(search.get("branchId"));
  if (branchId) filters.branchId = branchId;
  return filters;
}

export function adminCouponFiltersApplied(filters: AdminCouponListFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.status !== "all" ||
    filters.discountType !== "all" ||
    filters.validity !== "all" ||
    Boolean(filters.serviceId) ||
    Boolean(filters.branchId)
  );
}

export function countActiveAdminCouponFilters(filters: AdminCouponListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.discountType !== "all") count += 1;
  if (filters.validity !== "all") count += 1;
  if (filters.serviceId) count += 1;
  if (filters.branchId) count += 1;
  return count;
}

export function adminCouponsHref(input: Partial<AdminCouponListFilters> = {}): string {
  const filters: AdminCouponListFilters = {
    status: input.status ?? "all",
    discountType: input.discountType ?? "all",
    validity: input.validity ?? "all",
    sort: input.sort ?? "updatedAt",
    direction: input.direction ?? "desc",
    page: input.page ?? 1,
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.discountType !== "all") params.set("discountType", filters.discountType);
  if (filters.validity !== "all") params.set("validity", filters.validity);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.sort !== "updatedAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.coupons}?${query}` : routes.admin.coupons;
}

export function adminCouponDetailHref(reference: string): string {
  return routes.admin.couponDetail(reference);
}

export function adminCouponEditHref(reference: string): string {
  return routes.admin.couponEdit(reference);
}

export function adminCouponNewHref(): string {
  return routes.admin.couponNew;
}

export function filtersToAdminCouponParams(
  filters: AdminCouponListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.discountType !== "all") params.discountType = filters.discountType;
  if (filters.validity !== "all") params.validity = filters.validity;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.sort !== "updatedAt") params.sort = filters.sort;
  if (filters.direction !== "desc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function couponPermission(
  action: "view" | "create" | "edit" | "lifecycle",
): string {
  switch (action) {
    case "view":
      return "admin.coupons.view";
    case "create":
      return "admin.coupons.create";
    case "edit":
      return "admin.coupons.edit";
    case "lifecycle":
      return "admin.coupons.lifecycle";
    default:
      return "admin.coupons.view";
  }
}
