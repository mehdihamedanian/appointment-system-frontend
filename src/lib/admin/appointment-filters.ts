import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_APPOINTMENT_SORT_FIELDS,
  ADMIN_APPOINTMENT_STATUS_FILTERS,
  ADMIN_PAYMENT_STATUS_FILTERS,
  type AdminAppointmentListFilters,
  type AdminAppointmentSortDirection,
  type AdminAppointmentSortField,
  type AdminAppointmentStatusFilter,
  type AdminPaymentStatusFilter,
} from "@/types/admin-appointment";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !ISO_DATE.test(raw)) {
    return undefined;
  }
  return raw;
}

export function sanitizeSearchQuery(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 80);
}

export function sanitizeFilterId(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || !isSafePublicId(raw)) {
    return undefined;
  }
  return raw;
}

export function parseAdminAppointmentPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminAppointmentStatus(
  value: string | null | undefined,
): AdminAppointmentStatusFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_APPOINTMENT_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminAppointmentStatusFilter;
  }
  return "all";
}

export function parseAdminPaymentStatus(
  value: string | null | undefined,
): AdminPaymentStatusFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_PAYMENT_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminPaymentStatusFilter;
  }
  return "all";
}

export function parseAdminSortField(
  value: string | null | undefined,
): AdminAppointmentSortField {
  const raw = value?.trim() as AdminAppointmentSortField | undefined;
  if (raw && ADMIN_APPOINTMENT_SORT_FIELDS.includes(raw)) {
    return raw;
  }
  return "startsAt";
}

export function parseAdminSortDirection(
  value: string | null | undefined,
): AdminAppointmentSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

export function parseAdminAppointmentFilters(search: {
  get(name: string): string | null;
}): AdminAppointmentListFilters {
  const filters: AdminAppointmentListFilters = {
    status: parseAdminAppointmentStatus(search.get("status")),
    paymentStatus: parseAdminPaymentStatus(search.get("paymentStatus")),
    sort: parseAdminSortField(search.get("sort")),
    direction: parseAdminSortDirection(search.get("direction")),
    page: parseAdminAppointmentPage(search.get("page")),
  };
  const q = sanitizeSearchQuery(search.get("q"));
  if (q) filters.q = q;
  const date = sanitizeIsoDate(search.get("date"));
  if (date) filters.date = date;
  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  const serviceId = sanitizeFilterId(search.get("service"));
  if (serviceId) filters.serviceId = serviceId;
  const staffId = sanitizeFilterId(search.get("staff"));
  if (staffId) filters.staffId = staffId;
  const resourceId = sanitizeFilterId(search.get("resource"));
  if (resourceId) filters.resourceId = resourceId;
  const customerId = sanitizeFilterId(search.get("customer"));
  if (customerId) filters.customerId = customerId;
  const branchId = sanitizeFilterId(search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const bookingSource = search.get("source")?.trim();
  if (bookingSource && bookingSource !== "all") {
    filters.bookingSource = bookingSource.slice(0, 40);
  }
  return filters;
}

export function adminAppointmentFiltersApplied(filters: AdminAppointmentListFilters): boolean {
  return (
    Boolean(filters.q) ||
    Boolean(filters.date) ||
    Boolean(filters.from) ||
    Boolean(filters.to) ||
    filters.status !== "all" ||
    filters.paymentStatus !== "all" ||
    Boolean(filters.serviceId) ||
    Boolean(filters.staffId) ||
    Boolean(filters.resourceId) ||
    Boolean(filters.customerId) ||
    Boolean(filters.branchId) ||
    Boolean(filters.bookingSource)
  );
}

export function countActiveAdminAppointmentFilters(filters: AdminAppointmentListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.date || filters.from || filters.to) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.paymentStatus !== "all") count += 1;
  if (filters.serviceId) count += 1;
  if (filters.staffId) count += 1;
  if (filters.resourceId) count += 1;
  if (filters.customerId) count += 1;
  if (filters.branchId) count += 1;
  if (filters.bookingSource) count += 1;
  return count;
}

export function adminAppointmentsHref(input: Partial<AdminAppointmentListFilters> = {}): string {
  const params = new URLSearchParams();
  const status = input.status ?? "all";
  if (status !== "all") params.set("status", status);
  const paymentStatus = input.paymentStatus ?? "all";
  if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
  if (input.q) params.set("q", input.q);
  if (input.date) params.set("date", input.date);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.serviceId) params.set("service", input.serviceId);
  if (input.staffId) params.set("staff", input.staffId);
  if (input.resourceId) params.set("resource", input.resourceId);
  if (input.customerId) params.set("customer", input.customerId);
  if (input.branchId) params.set("branch", input.branchId);
  if (input.bookingSource) params.set("source", input.bookingSource);
  const sort = input.sort ?? "startsAt";
  if (sort !== "startsAt") params.set("sort", sort);
  const direction = input.direction ?? "desc";
  if (direction !== "desc") params.set("direction", direction);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `${routes.admin.appointments}?${query}` : routes.admin.appointments;
}

export function filtersToAdminListParams(filters: AdminAppointmentListFilters): Record<string, string> {
  const params: Record<string, string> = {
    page: String(filters.page),
    sort: filters.sort,
    direction: filters.direction,
  };
  if (filters.q) params.q = filters.q;
  if (filters.date) params.date = filters.date;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.paymentStatus !== "all") params.paymentStatus = filters.paymentStatus;
  if (filters.serviceId) params.serviceId = filters.serviceId;
  if (filters.staffId) params.staffId = filters.staffId;
  if (filters.resourceId) params.resourceId = filters.resourceId;
  if (filters.customerId) params.customerId = filters.customerId;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.bookingSource) params.bookingSource = filters.bookingSource;
  return params;
}
