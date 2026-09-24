import { apiClient } from "@/lib/api/client";
import {
  adaptAdminAppointmentDetail,
  adaptAdminAppointmentList,
  adaptAdminMutationResult,
  adaptCancellationPreview,
  adaptCancellationResult,
} from "@/lib/admin/appointment-adapter";
import { filtersToAdminListParams } from "@/lib/admin/appointment-filters";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { adaptCustomerTimeline } from "@/lib/customer/appointment-detail-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { CustomerTimelineEvent } from "@/types/appointment-detail";
import type {
  AdminAppointmentDetailView,
  AdminAppointmentListFilters,
  AdminAppointmentListView,
  AdminAppointmentMutationResult,
  AdminCancellationPreviewView,
  AdminCancellationResultView,
} from "@/types/admin-appointment";
import { ADMIN_APPOINTMENT_LIST_LIMIT } from "@/types/admin-appointment";

function buildListQuery(filters: AdminAppointmentListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminListParams(filters);
  params.set("limit", String(ADMIN_APPOINTMENT_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminAppointments(
  filters: AdminAppointmentListFilters,
  signal?: AbortSignal,
): Promise<AdminAppointmentListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/appointments?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminAppointmentList(payload, filters.page);
}

export async function fetchAdminAppointmentDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminAppointmentDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/appointments/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminAppointmentDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_APPOINTMENT_NOT_FOUND",
      message: "نوبت پیدا نشد.",
    });
  }
  return view;
}

export async function fetchAdminAppointmentTimeline(
  reference: string,
  signal?: AbortSignal,
): Promise<CustomerTimelineEvent[]> {
  try {
    const payload = await apiClient<unknown>(
      `/admin/appointments/${encodeURIComponent(reference)}/timeline`,
      { method: "GET", signal },
    );
    return adaptCustomerTimeline(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return [];
    }
    throw error;
  }
}

async function postAdminAction(
  reference: string,
  action: string,
  body: Record<string, unknown> | undefined,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminAppointmentMutationResult> {
  const payload = await apiClient<unknown>(
    `/admin/appointments/${encodeURIComponent(reference)}/${action}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body,
    },
  );
  const result = adaptAdminMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_ACTION_RESULT_INVALID",
      message: "پاسخ عملیات معتبر نیست.",
    });
  }
  return result;
}

export function submitAdminConfirm(
  reference: string,
  input: { version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return postAdminAction(reference, "confirm", input, idempotencyKey, signal);
}

export function submitAdminCheckIn(
  reference: string,
  input: { version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return postAdminAction(reference, "check-in", input, idempotencyKey, signal);
}

export function submitAdminStart(
  reference: string,
  input: { version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return postAdminAction(reference, "start", input, idempotencyKey, signal);
}

export function submitAdminComplete(
  reference: string,
  input: { version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return postAdminAction(reference, "complete", input, idempotencyKey, signal);
}

export function submitAdminNoShow(
  reference: string,
  input: { version?: string; reasonCode?: string; reasonText?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return postAdminAction(reference, "no-show", input, idempotencyKey, signal);
}

export async function fetchAdminCancellationPreview(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminCancellationPreviewView> {
  const payload = await apiClient<unknown>(
    `/admin/appointments/${encodeURIComponent(reference)}/cancellation-preview`,
    { method: "GET", signal },
  );
  const view = adaptCancellationPreview(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_CANCELLATION_PREVIEW_NOT_FOUND",
      message: "پیش‌نمایش لغو در دسترس نیست.",
    });
  }
  return view;
}

export async function submitAdminCancellation(
  reference: string,
  input: {
    reasonCode?: string;
    reasonText?: string;
    previewVersion?: string;
    version?: string;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCancellationResultView> {
  const payload = await apiClient<unknown>(
    `/admin/appointments/${encodeURIComponent(reference)}/cancellation`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptCancellationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_CANCELLATION_RESULT_INVALID",
      message: "پاسخ لغو نوبت معتبر نیست.",
    });
  }
  return result;
}

export async function submitAdminInternalNote(
  reference: string,
  input: { note: string; version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminAppointmentDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/appointments/${encodeURIComponent(reference)}/internal-note`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const view = adaptAdminAppointmentDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_INTERNAL_NOTE_INVALID",
      message: "ذخیره یادداشت داخلی ناموفق بود.",
    });
  }
  return view;
}

export function adminAppointmentListQueryOptions(
  userId: string,
  filters: AdminAppointmentListFilters,
) {
  return {
    queryKey: queryKeys.admin.appointmentList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminAppointments(filters, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export function adminAppointmentDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.appointmentDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminAppointmentDetail(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export function adminAppointmentTimelineQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.appointmentTimeline(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminAppointmentTimeline(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
  };
}

export function adminCancellationPreviewQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.appointmentCancellationPreview(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminCancellationPreview(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    retry: false,
  };
}

export function invalidateAdminAppointments(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
}
