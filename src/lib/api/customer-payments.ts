import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import {
  adaptPaymentHistoryDetail,
  adaptPaymentHistoryList,
  adaptPaymentReceiptUrl,
} from "@/lib/customer/payment-history-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { PaymentHistoryFilters } from "@/types/payment-history";
import {
  PAYMENT_HISTORY_LIST_LIMIT,
  type PaymentHistoryDetailView,
  type PaymentHistoryListView,
} from "@/types/payment-history";

function missingPaymentError(): ApiError {
  return new ApiError({
    status: 404,
    code: "PAYMENT_NOT_FOUND",
    message: "پرداخت پیدا نشد.",
  });
}

function buildListQuery(filters: PaymentHistoryFilters, cursor?: string): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page > 0 ? filters.page : 1));
  params.set("limit", String(PAYMENT_HISTORY_LIST_LIMIT));
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.appointmentId) {
    params.set("appointmentId", filters.appointmentId);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return params.toString();
}

export async function fetchCustomerPaymentHistory(
  filters: PaymentHistoryFilters,
  signal?: AbortSignal,
  cursor?: string,
): Promise<PaymentHistoryListView> {
  const payload = await apiClient<unknown>(`/customer/payments?${buildListQuery(filters, cursor)}`, {
    method: "GET",
    signal,
  });
  return adaptPaymentHistoryList(payload, filters);
}

export function customerPaymentHistoryQueryOptions(userId: string, filters: PaymentHistoryFilters) {
  return {
    queryKey: queryKeys.customer.paymentList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCustomerPaymentHistory(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchCustomerPaymentHistoryDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<PaymentHistoryDetailView> {
  if (!isSafePublicId(reference)) {
    throw missingPaymentError();
  }
  const payload = await apiClient<unknown>(`/customer/payments/${encodeURIComponent(reference)}`, {
    method: "GET",
    signal,
  });
  const view = adaptPaymentHistoryDetail(payload);
  if (!view) {
    throw missingPaymentError();
  }
  return view;
}

export function customerPaymentHistoryDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.paymentDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerPaymentHistoryDetail(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export type FetchPaymentReceiptResult =
  | { outcome: "url"; url: string }
  | { outcome: "missing_endpoint" }
  | { outcome: "unavailable" };

export async function fetchPaymentReceiptUrl(
  reference: string,
  signal?: AbortSignal,
): Promise<FetchPaymentReceiptResult> {
  if (!isSafePublicId(reference)) {
    return { outcome: "unavailable" };
  }
  try {
    const payload = await apiClient<unknown>(
      `/customer/payments/${encodeURIComponent(reference)}/receipt`,
      {
        method: "GET",
        signal,
      },
    );
    const url = adaptPaymentReceiptUrl(payload);
    if (!url) {
      return { outcome: "unavailable" };
    }
    return { outcome: "url", url };
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}
