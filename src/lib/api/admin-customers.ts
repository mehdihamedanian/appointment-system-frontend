import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminCustomerDetail,
  adaptAdminCustomerImpactPreview,
  adaptAdminCustomerList,
  adaptAdminCustomerMutationResult,
  adaptAdminCustomerPaymentHistory,
  sanitizeAdminCustomerBody,
} from "@/lib/admin/customer-adapter";
import { filtersToAdminCustomerParams } from "@/lib/admin/customer-filters";
import { adaptAdminCreateCustomerResult } from "@/lib/admin/manual-booking-adapter";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminCustomerDetailView,
  AdminCustomerFormInput,
  AdminCustomerImpactAction,
  AdminCustomerImpactPreview,
  AdminCustomerListFilters,
  AdminCustomerListView,
  AdminCustomerMutationResult,
  AdminCustomerNoteInput,
} from "@/types/admin-customer";
import { ADMIN_CUSTOMER_LIST_LIMIT } from "@/types/admin-customer";
import type { PaymentHistoryListView } from "@/types/payment-history";
import type { AdminManualBookingCreateCustomerResult } from "@/types/admin-manual-booking";

function buildListQuery(filters: AdminCustomerListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminCustomerParams(filters);
  params.set("limit", String(ADMIN_CUSTOMER_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminCustomerList(
  filters: AdminCustomerListFilters,
  signal?: AbortSignal,
): Promise<AdminCustomerListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/customers?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminCustomerList(payload, filters.page);
}

export async function fetchAdminCustomerDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminCustomerDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminCustomerDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_CUSTOMER_NOT_FOUND",
      message: "مشتری پیدا نشد.",
    });
  }
  return view;
}

export async function createAdminCustomerRecord(
  input: AdminCustomerFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminManualBookingCreateCustomerResult> {
  try {
    const payload = await apiClient<unknown>("/admin/customers", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminCustomerBody(input),
    });
    return adaptAdminCreateCustomerResult(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

export async function updateAdminCustomer(
  reference: string,
  input: AdminCustomerFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCustomerDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminCustomerBody(input, "update"),
    },
  );
  const view = adaptAdminCustomerDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CUSTOMER_INVALID",
      message: "پاسخ ویرایش مشتری معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminCustomerPaymentHistory(
  reference: string,
  page: number,
  signal?: AbortSignal,
): Promise<PaymentHistoryListView> {
  try {
    const payload = await apiClient<unknown>(
      `/admin/customers/${encodeURIComponent(reference)}/payments?page=${page}&limit=10`,
      { method: "GET", signal },
    );
    return adaptAdminCustomerPaymentHistory(payload, page);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return {
        items: [],
        page,
        hasMore: false,
        emptyHistory: true,
        filtersApplied: false,
      };
    }
    throw error;
  }
}

export async function fetchAdminCustomerImpactPreview(
  reference: string,
  action: AdminCustomerImpactAction,
  options: { version?: string; reason?: string } = {},
  signal?: AbortSignal,
): Promise<AdminCustomerImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: { action, version: options.version, reason: options.reason },
    },
  );
  const preview = adaptAdminCustomerImpactPreview(payload, action);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CUSTOMER_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function submitAdminCustomerLifecycleAction(
  reference: string,
  action: AdminCustomerImpactAction,
  input: { previewVersion?: string; version?: string; reason?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCustomerMutationResult> {
  const pathAction =
    action === "block"
      ? "block"
      : action === "unblock"
        ? "unblock"
        : action === "deactivate"
          ? "deactivate"
          : "activate";

  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}/${pathAction}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminCustomerMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CUSTOMER_ACTION_INVALID",
      message: "پاسخ عملیات مشتری معتبر نیست.",
    });
  }
  return result;
}

export async function appendAdminCustomerNote(
  reference: string,
  input: AdminCustomerNoteInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCustomerMutationResult> {
  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}/notes`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminCustomerMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CUSTOMER_NOTE_INVALID",
      message: "پاسخ یادداشت معتبر نیست.",
    });
  }
  return result;
}

export async function updateAdminCustomerTags(
  reference: string,
  input: { tagIds: string[]; version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCustomerMutationResult> {
  const payload = await apiClient<unknown>(
    `/admin/customers/${encodeURIComponent(reference)}/tags`,
    {
      method: "PUT",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminCustomerMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CUSTOMER_TAGS_INVALID",
      message: "پاسخ برچسب‌ها معتبر نیست.",
    });
  }
  return result;
}

export function adminCustomerListQueryOptions(userId: string, filters: AdminCustomerListFilters) {
  return {
    queryKey: queryKeys.admin.customerList(userId, filters),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminCustomerList(filters, signal),
    staleTime: 30_000,
  };
}

export function adminCustomerDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.customerDetail(userId, reference),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminCustomerDetail(reference, signal),
    staleTime: 30_000,
  };
}

export function adminCustomerPaymentsQueryOptions(userId: string, reference: string, page: number) {
  return {
    queryKey: queryKeys.admin.customerPayments(userId, reference, page),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminCustomerPaymentHistory(reference, page, signal),
    staleTime: 30_000,
  };
}
