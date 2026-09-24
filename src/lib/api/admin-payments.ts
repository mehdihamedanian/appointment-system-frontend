import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import {
  adaptAdminManualPaymentOptions,
  adaptAdminManualPaymentResult,
  adaptAdminPaymentDetail,
  adaptAdminPaymentList,
  adaptAdminPaymentRefundPreview,
  adaptAdminPaymentRefundResult,
  adaptAdminPaymentRevenueSummary,
  adaptPaymentReceiptUrl,
} from "@/lib/admin/payment-adapter";
import { filtersToAdminPaymentParams } from "@/lib/admin/payment-filters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminManualPaymentInput,
  AdminManualPaymentOptionsView,
  AdminManualPaymentResult,
  AdminPaymentDetailView,
  AdminPaymentListFilters,
  AdminPaymentListView,
  AdminPaymentRefundInput,
  AdminPaymentRefundPreview,
  AdminPaymentRefundResult,
  AdminPaymentRevenueSummaryView,
} from "@/types/admin-payment";
import { ADMIN_PAYMENT_LIST_LIMIT } from "@/types/admin-payment";

function missingPaymentError(): ApiError {
  return new ApiError({
    status: 404,
    code: "ADMIN_PAYMENT_NOT_FOUND",
    message: "پرداخت پیدا نشد.",
  });
}

function buildListQuery(filters: AdminPaymentListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_PAYMENT_LIST_LIMIT));
  params.set("page", String(filters.page > 0 ? filters.page : 1));
  for (const [key, value] of Object.entries(filtersToAdminPaymentParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

function buildRevenueQuery(filters: AdminPaymentListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtersToAdminPaymentParams(filters))) {
    if (key !== "page" && key !== "sort" && key !== "direction") {
      params.set(key, value);
    }
  }
  return params.toString();
}

export async function fetchAdminPaymentList(
  filters: AdminPaymentListFilters,
  signal?: AbortSignal,
): Promise<AdminPaymentListView> {
  const payload = await apiClient<unknown>(`/admin/payments?${buildListQuery(filters)}`, {
    method: "GET",
    signal,
  });
  return adaptAdminPaymentList(payload, filters);
}

export function adminPaymentListQueryOptions(userId: string, filters: AdminPaymentListFilters) {
  return {
    queryKey: queryKeys.admin.paymentList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminPaymentList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchAdminPaymentDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminPaymentDetailView> {
  if (!isSafePublicId(reference)) {
    throw missingPaymentError();
  }
  const payload = await apiClient<unknown>(
    `/admin/payments/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminPaymentDetail(payload);
  if (!view) {
    throw missingPaymentError();
  }
  return view;
}

export function adminPaymentDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.paymentDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminPaymentDetail(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchAdminPaymentRevenueSummary(
  filters: AdminPaymentListFilters,
  signal?: AbortSignal,
): Promise<AdminPaymentRevenueSummaryView> {
  const query = buildRevenueQuery(filters);
  try {
    const payload = await apiClient<unknown>(`/admin/payments/summary?${query}`, {
      method: "GET",
      signal,
    });
    return adaptAdminPaymentRevenueSummary(payload);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { state: "unavailable" };
    }
    throw error;
  }
}

export function adminPaymentRevenueSummaryQueryOptions(
  userId: string,
  filters: AdminPaymentListFilters,
  enabled: boolean,
) {
  return {
    queryKey: queryKeys.admin.paymentRevenueSummary(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminPaymentRevenueSummary(filters, signal),
    enabled,
    staleTime: 30_000,
    retry: false,
  };
}

export async function fetchAdminPaymentRefundPreview(
  reference: string,
  input: AdminPaymentRefundInput = {},
  signal?: AbortSignal,
): Promise<AdminPaymentRefundPreview> {
  if (!isSafePublicId(reference)) {
    throw missingPaymentError();
  }
  const payload = await apiClient<unknown>(
    `/admin/payments/${encodeURIComponent(reference)}/refund-preview`,
    {
      method: "POST",
      signal,
      body: {
        ...(input.amountLabel ? { amountLabel: input.amountLabel } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      },
    },
  );
  const preview = adaptAdminPaymentRefundPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "REFUND_PREVIEW_INVALID",
      message: "پیش‌نمایش بازپرداخت در دسترس نیست.",
    });
  }
  return preview;
}

export async function submitAdminPaymentRefund(
  reference: string,
  input: AdminPaymentRefundInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminPaymentRefundResult> {
  if (!isSafePublicId(reference)) {
    throw missingPaymentError();
  }
  const payload = await apiClient<unknown>(
    `/admin/payments/${encodeURIComponent(reference)}/refund`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...(input.amountLabel ? { amountLabel: input.amountLabel } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      },
    },
  );
  const result = adaptAdminPaymentRefundResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "REFUND_RESULT_INVALID",
      message: "پاسخ بازپرداخت نامعتبر بود.",
    });
  }
  return result;
}

export async function fetchAdminManualPaymentOptions(
  appointmentReference: string,
  signal?: AbortSignal,
): Promise<AdminManualPaymentOptionsView> {
  if (!isSafePublicId(appointmentReference)) {
    return { appointmentReference: "", options: [], state: "unavailable" };
  }
  try {
    const payload = await apiClient<unknown>(
      `/admin/payments/manual-options?appointmentId=${encodeURIComponent(appointmentReference)}`,
      { method: "GET", signal },
    );
    return adaptAdminManualPaymentOptions(payload);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { appointmentReference, options: [], state: "unavailable" };
    }
    throw error;
  }
}

export async function submitAdminManualPayment(
  input: AdminManualPaymentInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminManualPaymentResult> {
  const payload = await apiClient<unknown>("/admin/payments/manual", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      appointmentId: input.appointmentReference,
      method: input.method,
      ...(input.amountLabel ? { amountLabel: input.amountLabel } : {}),
      ...(input.receiptReference ? { receiptReference: input.receiptReference } : {}),
      ...(input.internalNote ? { internalNote: input.internalNote } : {}),
    },
  });
  const result = adaptAdminManualPaymentResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "MANUAL_PAYMENT_INVALID",
      message: "ثبت پرداخت دستی ناموفق بود.",
    });
  }
  return result;
}

export type FetchAdminPaymentReceiptResult =
  | { outcome: "url"; url: string }
  | { outcome: "missing_endpoint" }
  | { outcome: "unavailable" };

export async function fetchAdminPaymentReceiptUrl(
  reference: string,
  signal?: AbortSignal,
): Promise<FetchAdminPaymentReceiptResult> {
  if (!isSafePublicId(reference)) {
    return { outcome: "unavailable" };
  }
  try {
    const payload = await apiClient<unknown>(
      `/admin/payments/${encodeURIComponent(reference)}/receipt`,
      { method: "GET", signal },
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
