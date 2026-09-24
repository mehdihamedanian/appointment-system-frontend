import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminNotificationLogDetail,
  adaptAdminNotificationLogList,
  adaptAdminNotificationPreviewResult,
  adaptAdminNotificationTemplateDetail,
  adaptAdminNotificationTemplateList,
  adaptAdminNotificationToggleImpactPreview,
  sanitizeAdminNotificationTemplateBody,
} from "@/lib/admin/notification-adapter";
import {
  filtersToAdminNotificationLogParams,
  filtersToAdminNotificationTemplateParams,
} from "@/lib/admin/notification-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminNotificationLogDetailView,
  AdminNotificationLogListFilters,
  AdminNotificationLogListView,
  AdminNotificationPreviewInput,
  AdminNotificationPreviewResult,
  AdminNotificationTemplateDetailView,
  AdminNotificationTemplateListFilters,
  AdminNotificationTemplateListView,
  AdminNotificationTemplateSaveInput,
  AdminNotificationToggleAction,
  AdminNotificationToggleImpactPreview,
} from "@/types/admin-notification";
import {
  ADMIN_NOTIFICATION_LOG_LIST_LIMIT,
  ADMIN_NOTIFICATION_TEMPLATE_LIST_LIMIT,
} from "@/types/admin-notification";

function buildTemplateListQuery(filters: AdminNotificationTemplateListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_NOTIFICATION_TEMPLATE_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminNotificationTemplateParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

function buildLogListQuery(filters: AdminNotificationLogListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_NOTIFICATION_LOG_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminNotificationLogParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminNotificationTemplateList(
  filters: AdminNotificationTemplateListFilters,
  signal?: AbortSignal,
): Promise<AdminNotificationTemplateListView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/templates?${buildTemplateListQuery(filters)}`,
    { method: "GET", signal },
  );
  return adaptAdminNotificationTemplateList(payload, filters);
}

export function adminNotificationTemplateListQueryOptions(
  userId: string,
  filters: AdminNotificationTemplateListFilters,
) {
  return {
    queryKey: queryKeys.admin.notificationTemplateList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminNotificationTemplateList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function fetchAdminNotificationTemplateDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminNotificationTemplateDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/templates/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminNotificationTemplateDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND",
      message: "قالب اعلان پیدا نشد.",
    });
  }
  return view;
}

export function adminNotificationTemplateDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.notificationTemplateDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminNotificationTemplateDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function saveAdminNotificationTemplate(
  reference: string,
  input: AdminNotificationTemplateSaveInput,
  channel: "sms" | "email",
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminNotificationTemplateDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/templates/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminNotificationTemplateBody(input, channel),
    },
  );
  const view = adaptAdminNotificationTemplateDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_NOTIFICATION_TEMPLATE_INVALID",
      message: "ذخیره قالب نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminNotificationToggleImpactPreview(
  reference: string,
  action: AdminNotificationToggleAction,
  signal?: AbortSignal,
): Promise<AdminNotificationToggleImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/templates/${encodeURIComponent(reference)}/impact-preview`,
    { method: "POST", signal, body: { action } },
  );
  const preview = adaptAdminNotificationToggleImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "NOTIFICATION_TOGGLE_PREVIEW_INVALID",
      message: "پیش‌نمایش اثر در دسترس نیست.",
    });
  }
  return preview;
}

export async function submitAdminNotificationToggle(
  reference: string,
  action: AdminNotificationToggleAction,
  idempotencyKey: string,
  input?: { previewVersion?: string; version?: string },
  signal?: AbortSignal,
): Promise<AdminNotificationTemplateDetailView> {
  const path = action === "enable" ? "enable" : "disable";
  const payload = await apiClient<unknown>(
    `/admin/notifications/templates/${encodeURIComponent(reference)}/${path}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input ?? {},
    },
  );
  const view = adaptAdminNotificationTemplateDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "NOTIFICATION_TOGGLE_INVALID",
      message: "تغییر وضعیت قالب نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminNotificationPreview(
  reference: string,
  input: AdminNotificationPreviewInput,
  signal?: AbortSignal,
): Promise<AdminNotificationPreviewResult> {
  try {
    const payload = await apiClient<unknown>(
      `/admin/notifications/templates/${encodeURIComponent(reference)}/preview`,
      { method: "POST", signal, body: input },
    );
    const result = adaptAdminNotificationPreviewResult(payload);
    if (!result) {
      throw new ApiError({
        status: 422,
        code: "NOTIFICATION_PREVIEW_INVALID",
        message: "پیش‌نمایش قالب در دسترس نیست.",
      });
    }
    return result;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "NOTIFICATION_PREVIEW_ENDPOINT_MISSING",
        message: "پیش‌نمایش قالب هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function fetchAdminNotificationLogList(
  filters: AdminNotificationLogListFilters,
  signal?: AbortSignal,
): Promise<AdminNotificationLogListView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/logs?${buildLogListQuery(filters)}`,
    { method: "GET", signal },
  );
  return adaptAdminNotificationLogList(payload, filters);
}

export function adminNotificationLogListQueryOptions(
  userId: string,
  filters: AdminNotificationLogListFilters,
) {
  return {
    queryKey: queryKeys.admin.notificationLogList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminNotificationLogList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function fetchAdminNotificationLogDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminNotificationLogDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/logs/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminNotificationLogDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_NOTIFICATION_LOG_NOT_FOUND",
      message: "گزارش ارسال پیدا نشد.",
    });
  }
  return view;
}

export function adminNotificationLogDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.notificationLogDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminNotificationLogDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function retryAdminNotificationLog(
  reference: string,
  idempotencyKey: string,
  input?: { version?: string },
  signal?: AbortSignal,
): Promise<AdminNotificationLogDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/notifications/logs/${encodeURIComponent(reference)}/retry`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input ?? {},
    },
  );
  const view = adaptAdminNotificationLogDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "NOTIFICATION_LOG_RETRY_INVALID",
      message: "تلاش مجدد ارسال ناموفق بود.",
    });
  }
  return view;
}
