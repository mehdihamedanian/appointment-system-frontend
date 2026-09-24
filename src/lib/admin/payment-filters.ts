import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  parsePaymentHistoryPage,
  parsePaymentHistoryStatus,
  sanitizeIsoDate,
  sanitizePaymentSearchQuery,
} from "@/lib/customer/payment-history-filters";
import {
  ADMIN_PAYMENT_METHOD_FILTERS,
  ADMIN_PAYMENT_REFUND_STATUS_FILTERS,
  ADMIN_PAYMENT_SORT_FIELDS,
  type AdminPaymentListFilters,
  type AdminPaymentMethodFilter,
  type AdminPaymentRefundStatusFilter,
  type AdminPaymentSortDirection,
  type AdminPaymentSortField,
} from "@/types/admin-payment";

export function parseAdminPaymentRefundStatus(
  value: string | null | undefined,
): AdminPaymentRefundStatusFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_PAYMENT_REFUND_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminPaymentRefundStatusFilter;
  }
  return "all";
}

export function parseAdminPaymentMethod(
  value: string | null | undefined,
): AdminPaymentMethodFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_PAYMENT_METHOD_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminPaymentMethodFilter;
  }
  return "all";
}

export function parseAdminPaymentSort(value: string | null | undefined): AdminPaymentSortField {
  const raw = value?.trim() as AdminPaymentSortField | undefined;
  if (raw && ADMIN_PAYMENT_SORT_FIELDS.includes(raw)) return raw;
  return "createdAt";
}

export function parseAdminPaymentDirection(
  value: string | null | undefined,
): AdminPaymentSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function sanitizeReferenceFilter(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) return undefined;
  return raw;
}

export function parseAdminPaymentFilters(search: {
  get(name: string): string | null;
}): AdminPaymentListFilters {
  const filters: AdminPaymentListFilters = {
    status: parsePaymentHistoryStatus(search.get("status")),
    refundStatus: parseAdminPaymentRefundStatus(search.get("refundStatus")),
    method: parseAdminPaymentMethod(search.get("method")),
    sort: parseAdminPaymentSort(search.get("sort")),
    direction: parseAdminPaymentDirection(search.get("direction")),
    page: parsePaymentHistoryPage(search.get("page")),
  };
  const q = sanitizePaymentSearchQuery(search.get("q"));
  if (q) filters.q = q;
  const appointmentId =
    sanitizeReferenceFilter(search.get("appointment")) ??
    sanitizeReferenceFilter(search.get("appointmentId"));
  if (appointmentId) filters.appointmentId = appointmentId;
  const customerId =
    sanitizeReferenceFilter(search.get("customer")) ??
    sanitizeReferenceFilter(search.get("customerId"));
  if (customerId) filters.customerId = customerId;
  const branchId = sanitizeReferenceFilter(search.get("branchId"));
  if (branchId) filters.branchId = branchId;
  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  return filters;
}

export function adminPaymentFiltersApplied(filters: AdminPaymentListFilters): boolean {
  return (
    filters.status !== "all" ||
    filters.refundStatus !== "all" ||
    filters.method !== "all" ||
    Boolean(filters.q) ||
    Boolean(filters.appointmentId) ||
    Boolean(filters.customerId) ||
    Boolean(filters.branchId) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

export function countActiveAdminPaymentFilters(filters: AdminPaymentListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.refundStatus !== "all") count += 1;
  if (filters.method !== "all") count += 1;
  if (filters.appointmentId) count += 1;
  if (filters.customerId) count += 1;
  if (filters.branchId) count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  return count;
}

export function adminPaymentsHref(input: Partial<AdminPaymentListFilters> = {}): string {
  const filters: AdminPaymentListFilters = {
    status: input.status ?? "all",
    refundStatus: input.refundStatus ?? "all",
    method: input.method ?? "all",
    sort: input.sort ?? "createdAt",
    direction: input.direction ?? "desc",
    page: input.page ?? 1,
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.refundStatus !== "all") params.set("refundStatus", filters.refundStatus);
  if (filters.method !== "all") params.set("method", filters.method);
  if (filters.appointmentId) params.set("appointment", filters.appointmentId);
  if (filters.customerId) params.set("customer", filters.customerId);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.payments}?${query}` : routes.admin.payments;
}

export function adminPaymentDetailHref(reference: string): string {
  return routes.admin.paymentDetail(reference);
}

export function filtersToAdminPaymentParams(
  filters: AdminPaymentListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.refundStatus !== "all") params.refundStatus = filters.refundStatus;
  if (filters.method !== "all") params.method = filters.method;
  if (filters.appointmentId) params.appointmentId = filters.appointmentId;
  if (filters.customerId) params.customerId = filters.customerId;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.sort !== "createdAt") params.sort = filters.sort;
  if (filters.direction !== "desc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function paymentPermission(
  action: "view" | "detail" | "revenue" | "manual" | "refund" | "receipt" | "private",
): string {
  switch (action) {
    case "view":
      return "admin.payments.view";
    case "detail":
      return "admin.payments.view";
    case "revenue":
      return "admin.payments.revenue.view";
    case "manual":
      return "admin.payments.manual.record";
    case "refund":
      return "admin.payments.refund";
    case "receipt":
      return "admin.payments.receipt";
    case "private":
      return "admin.payments.financial.view";
    default:
      return "admin.payments.view";
  }
}
