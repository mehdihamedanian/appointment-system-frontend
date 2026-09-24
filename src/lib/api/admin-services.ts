import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminServiceDetail,
  adaptAdminServiceImpactPreview,
  adaptAdminServiceList,
  adaptAdminServiceMutationResult,
  sanitizeAdminServiceBody,
} from "@/lib/admin/service-adapter";
import { filtersToAdminServiceParams } from "@/lib/admin/service-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminServiceDetailView,
  AdminServiceFormInput,
  AdminServiceImpactAction,
  AdminServiceImpactPreview,
  AdminServiceListFilters,
  AdminServiceListView,
  AdminServiceMutationResult,
} from "@/types/admin-service";
import { ADMIN_SERVICE_LIST_LIMIT } from "@/types/admin-service";

function buildListQuery(filters: AdminServiceListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminServiceParams(filters);
  params.set("limit", String(ADMIN_SERVICE_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminServiceList(
  filters: AdminServiceListFilters,
  signal?: AbortSignal,
): Promise<AdminServiceListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/services?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminServiceList(payload, filters.page);
}

export async function fetchAdminServiceDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminServiceDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminServiceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_SERVICE_NOT_FOUND",
      message: "خدمت پیدا نشد.",
    });
  }
  return view;
}

export async function createAdminService(
  input: AdminServiceFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/services", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminServiceBody(input),
    });
    const view = adaptAdminServiceDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_SERVICE_INVALID",
        message: "پاسخ ایجاد خدمت معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_SERVICE_ENDPOINT_MISSING",
        message: "ایجاد خدمت هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminService(
  reference: string,
  input: AdminServiceFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminServiceBody(input),
    },
  );
  const view = adaptAdminServiceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_INVALID",
      message: "پاسخ ویرایش خدمت معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminServiceImpactPreview(
  reference: string,
  action: AdminServiceImpactAction,
  context: { version?: string; branchId?: string } = {},
  signal?: AbortSignal,
): Promise<AdminServiceImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: {
        action,
        version: context.version,
        branchId: context.branchId,
      },
    },
  );
  const preview = adaptAdminServiceImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return { ...preview, action };
}

export async function fetchAdminServiceFormImpactPreview(
  reference: string,
  input: AdminServiceFormInput,
  signal?: AbortSignal,
): Promise<AdminServiceImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: sanitizeAdminServiceBody(input),
    },
  );
  const preview = adaptAdminServiceImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function submitAdminServiceLifecycleAction(
  reference: string,
  action: AdminServiceImpactAction,
  context: { previewVersion?: string; version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceMutationResult> {
  const path =
    action === "delete"
      ? `/admin/services/${encodeURIComponent(reference)}`
      : `/admin/services/${encodeURIComponent(reference)}/${action}`;
  const payload = await apiClient<unknown>(path, {
    method: action === "delete" ? "DELETE" : "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      previewVersion: context.previewVersion,
      version: context.version,
    },
  });
  const result = adaptAdminServiceMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_ACTION_INVALID",
      message: "پاسخ عملیات خدمت معتبر نیست.",
    });
  }
  return result;
}

export async function uploadAdminServiceImage(
  reference: string,
  file: File,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceDetailView> {
  const formData = new FormData();
  formData.append("image", file);
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}/image`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: formData,
    },
  );
  const view = adaptAdminServiceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_IMAGE_INVALID",
      message: "پاسخ آپلود تصویر معتبر نیست.",
    });
  }
  return view;
}

export async function removeAdminServiceImage(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(reference)}/image`,
    {
      method: "DELETE",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
  const view = adaptAdminServiceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_IMAGE_INVALID",
      message: "پاسخ حذف تصویر معتبر نیست.",
    });
  }
  return view;
}

export async function reorderAdminServices(
  items: Array<{ reference: string; sortOrder: number }>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiClient<unknown>("/admin/services/reorder", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { items },
  });
}

export function adminServiceListQueryOptions(userId: string, filters: AdminServiceListFilters) {
  return {
    queryKey: queryKeys.admin.serviceList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminServiceList(filters, signal),
    enabled: Boolean(userId),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export function adminServiceDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.serviceDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminServiceDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}
