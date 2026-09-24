import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminWaitingListAvailabilityDays,
  adaptAdminWaitingListAvailabilitySlots,
  adaptAdminWaitingListDetail,
  adaptAdminWaitingListDuplicateCheck,
  adaptAdminWaitingListImpactPreview,
  adaptAdminWaitingListList,
  adaptAdminWaitingListOfferEligibility,
  adaptAdminWaitingListOfferPreview,
  adaptAdminWaitingListOfferSendResult,
  sanitizeAdminWaitingListManualEntryBody,
} from "@/lib/admin/waiting-list-adapter";
import { filtersToAdminWaitingListParams } from "@/lib/admin/waiting-list-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminWaitingListDetailView,
  AdminWaitingListDuplicateCheck,
  AdminWaitingListImpactAction,
  AdminWaitingListImpactPreview,
  AdminWaitingListListFilters,
  AdminWaitingListListView,
  AdminWaitingListManualEntryInput,
  AdminWaitingListOfferEligibility,
  AdminWaitingListOfferPreview,
  AdminWaitingListOfferSendResult,
  AdminWaitingListAvailabilityDay,
  AdminWaitingListAvailabilitySlot,
} from "@/types/admin-waiting-list";
import { ADMIN_WAITING_LIST_LIST_LIMIT } from "@/types/admin-waiting-list";

function buildListQuery(filters: AdminWaitingListListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_WAITING_LIST_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminWaitingListParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminWaitingList(
  filters: AdminWaitingListListFilters,
  signal?: AbortSignal,
): Promise<AdminWaitingListListView> {
  const payload = await apiClient<unknown>(`/admin/waiting-list?${buildListQuery(filters)}`, {
    method: "GET",
    signal,
  });
  return adaptAdminWaitingListList(payload, filters);
}

export function adminWaitingListQueryOptions(userId: string, filters: AdminWaitingListListFilters) {
  return {
    queryKey: queryKeys.admin.waitingListList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminWaitingList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchAdminWaitingListDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminWaitingListDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_WAITING_LIST_NOT_FOUND",
      message: "درخواست لیست انتظار پیدا نشد.",
    });
  }
  return view;
}

export function adminWaitingListDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.waitingListDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminWaitingListDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function createAdminWaitingListEntry(
  input: AdminWaitingListManualEntryInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/waiting-list", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminWaitingListManualEntryBody(input),
    });
    const view = adaptAdminWaitingListDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_WAITING_LIST_INVALID",
        message: "پاسخ ثبت لیست انتظار معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_WAITING_LIST_ENDPOINT_MISSING",
        message: "ثبت لیست انتظار هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function checkAdminWaitingListDuplicate(
  input: Pick<AdminWaitingListManualEntryInput, "customerReference" | "serviceId" | "branchId">,
  signal?: AbortSignal,
): Promise<AdminWaitingListDuplicateCheck> {
  const params = new URLSearchParams();
  params.set("customerReference", input.customerReference);
  params.set("serviceId", input.serviceId);
  if (input.branchId) params.set("branchId", input.branchId);
  try {
    const payload = await apiClient<unknown>(
      `/admin/waiting-list/duplicate-check?${params.toString()}`,
      { method: "GET", signal },
    );
    return adaptAdminWaitingListDuplicateCheck(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { duplicate: false };
    }
    throw error;
  }
}

export async function fetchAdminWaitingListImpactPreview(
  reference: string,
  action: AdminWaitingListImpactAction,
  signal?: AbortSignal,
): Promise<AdminWaitingListImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: { action },
    },
  );
  const preview = adaptAdminWaitingListImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_IMPACT_INVALID",
      message: "پیش‌نمایش اثر در دسترس نیست.",
    });
  }
  return preview;
}

export async function submitAdminWaitingListLifecycleAction(
  reference: string,
  action: AdminWaitingListImpactAction,
  idempotencyKey: string,
  input?: { reason?: string; previewVersion?: string; version?: string },
  signal?: AbortSignal,
): Promise<AdminWaitingListDetailView> {
  const path =
    action === "remove" ? "remove" : action === "cancel" ? "cancel" : "close";
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/${path}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        reason: input?.reason,
        previewVersion: input?.previewVersion,
        version: input?.version,
      },
    },
  );
  const view = adaptAdminWaitingListDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_LIFECYCLE_INVALID",
      message: "عملیات لیست انتظار نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminWaitingListOfferEligibility(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListOfferEligibility> {
  try {
    const payload = await apiClient<unknown>(
      `/admin/waiting-list/${encodeURIComponent(reference)}/offer-eligibility`,
      { method: "GET", signal },
    );
    return adaptAdminWaitingListOfferEligibility(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { eligible: false, reason: "بررسی امکان ارسال پیشنهاد هنوز متصل نیست." };
    }
    throw error;
  }
}

export function adminWaitingListOfferEligibilityQueryOptions(
  userId: string,
  reference: string,
) {
  return {
    queryKey: queryKeys.admin.waitingListOfferEligibility(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminWaitingListOfferEligibility(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 10_000,
    retry: false,
  };
}

export async function fetchAdminWaitingListAvailabilityDays(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListAvailabilityDay[]> {
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/availability/dates`,
    { method: "GET", signal },
  );
  return adaptAdminWaitingListAvailabilityDays(payload);
}

export async function fetchAdminWaitingListAvailabilitySlots(
  reference: string,
  date: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListAvailabilitySlot[]> {
  const params = new URLSearchParams({ date });
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/availability/slots?${params.toString()}`,
    { method: "GET", signal },
  );
  return adaptAdminWaitingListAvailabilitySlots(payload);
}

export function adminWaitingListAvailabilitySlotsQueryOptions(
  userId: string,
  reference: string,
  date: string,
) {
  return {
    queryKey: queryKeys.admin.waitingListAvailability(userId, reference, date),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminWaitingListAvailabilitySlots(reference, date, signal),
    enabled: Boolean(userId) && Boolean(reference) && Boolean(date),
    staleTime: 0,
    retry: false,
  };
}

export async function fetchAdminWaitingListOfferPreview(
  reference: string,
  input: { slotId: string; expirationOptionId?: string; previewVersion?: string },
  signal?: AbortSignal,
): Promise<AdminWaitingListOfferPreview> {
  const body: Record<string, string> = { slotId: input.slotId };
  if (input.expirationOptionId) body.expirationOptionId = input.expirationOptionId;
  if (input.previewVersion) body.previewVersion = input.previewVersion;
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/offer-preview`,
    {
      method: "POST",
      signal,
      body,
    },
  );
  const preview = adaptAdminWaitingListOfferPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_OFFER_PREVIEW_INVALID",
      message: "پیش‌نمایش پیشنهاد در دسترس نیست.",
    });
  }
  return preview;
}

export async function sendAdminWaitingListOffer(
  reference: string,
  input: {
    slotId: string;
    expirationOptionId: string;
    previewVersion?: string;
    version?: string;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListOfferSendResult> {
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/offers`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminWaitingListOfferSendResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_OFFER_INVALID",
      message: "پاسخ ارسال پیشنهاد معتبر نیست.",
    });
  }
  return result;
}

export async function retryAdminWaitingListNotification(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminWaitingListDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/waiting-list/${encodeURIComponent(reference)}/notifications/retry`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {},
    },
  );
  const view = adaptAdminWaitingListDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_NOTIFICATION_INVALID",
      message: "تلاش مجدد اعلان ناموفق بود.",
    });
  }
  return view;
}
