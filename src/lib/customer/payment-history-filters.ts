import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  PAYMENT_HISTORY_STATUS_FILTERS,
  type PaymentHistoryFilters,
  type PaymentHistoryStatusFilter,
} from "@/types/payment-history";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePaymentHistoryStatus(
  value: string | null | undefined,
): PaymentHistoryStatusFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (PAYMENT_HISTORY_STATUS_FILTERS as string[]).includes(raw)) {
    return raw as PaymentHistoryStatusFilter;
  }
  return "all";
}

export function parsePaymentHistoryPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizePaymentSearchQuery(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 80);
}

export function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !ISO_DATE.test(raw)) {
    return undefined;
  }
  return raw;
}

export function sanitizeAppointmentFilter(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

export function parsePaymentHistoryFilters(search: {
  get(name: string): string | null;
}): PaymentHistoryFilters {
  const filters: PaymentHistoryFilters = {
    status: parsePaymentHistoryStatus(search.get("status")),
    page: parsePaymentHistoryPage(search.get("page")),
  };
  const q = sanitizePaymentSearchQuery(search.get("q"));
  if (q) filters.q = q;
  const appointmentId =
    sanitizeAppointmentFilter(search.get("appointment")) ??
    sanitizeAppointmentFilter(search.get("appointmentId"));
  if (appointmentId) filters.appointmentId = appointmentId;
  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  return filters;
}

export function paymentHistoryFiltersApplied(filters: PaymentHistoryFilters): boolean {
  return (
    filters.status !== "all" ||
    Boolean(filters.q) ||
    Boolean(filters.appointmentId) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

export function paymentsHref(input: Partial<PaymentHistoryFilters> = {}): string {
  const params = new URLSearchParams();
  const status = input.status ?? "all";
  if (status !== "all") {
    params.set("status", status);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  if (input.appointmentId) {
    params.set("appointment", input.appointmentId);
  }
  if (input.from) {
    params.set("from", input.from);
  }
  if (input.to) {
    params.set("to", input.to);
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const query = params.toString();
  return query ? `${routes.customer.payments}?${query}` : routes.customer.payments;
}
