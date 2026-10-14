import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminStaffDetail,
  adaptAdminStaffImpactPreview,
  adaptAdminStaffList,
  adaptAdminStaffMutationResult,
  adaptAdminStaffPerformance,
} from "@/lib/admin/staff-adapter";
import { filtersToAdminStaffParams } from "@/lib/admin/staff-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminStaffDetailView,
  AdminStaffFormInput,
  AdminStaffImpactAction,
  AdminStaffImpactPreview,
  AdminStaffListFilters,
  AdminStaffListView,
  AdminStaffMutationResult,
  AdminStaffPerformanceView,
} from "@/types/admin-staff";
import { ADMIN_STAFF_LIST_LIMIT } from "@/types/admin-staff";

function buildListQuery(filters: AdminStaffListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminStaffParams(filters);
  params.set("limit", String(ADMIN_STAFF_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminStaffList(
  filters: AdminStaffListFilters,
  signal?: AbortSignal,
): Promise<AdminStaffListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/staff?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminStaffList(payload, filters.page);
}

export async function fetchAdminStaffDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminStaffDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminStaffDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_STAFF_NOT_FOUND",
      message: "کارمند پیدا نشد.",
    });
  }
  return view;
}

export async function fetchAdminStaffPerformance(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminStaffPerformanceView> {
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}/performance`,
    { method: "GET", signal },
  );
  const view = adaptAdminStaffPerformance(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_STAFF_PERFORMANCE_NOT_FOUND",
      message: "گزارش عملکرد در دسترس نیست.",
    });
  }
  return view;
}

export async function createAdminStaff(
  input: AdminStaffFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminStaffDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/staff", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeStaffBody(input, "create"),
    });
    const view = adaptAdminStaffDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_STAFF_INVALID",
        message: "پاسخ ایجاد کارمند معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_STAFF_ENDPOINT_MISSING",
        message: "ایجاد کارمند هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminStaff(
  reference: string,
  input: AdminStaffFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminStaffDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeStaffBody(input, "update"),
    },
  );
  const view = adaptAdminStaffDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_STAFF_INVALID",
      message: "پاسخ ویرایش کارمند معتبر نیست.",
    });
  }
  return view;
}

export async function uploadAdminStaffAvatar(
  reference: string,
  file: File,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminStaffDetailView> {
  const formData = new FormData();
  formData.append("avatar", file);
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}/avatar`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: formData,
    },
  );
  const view = adaptAdminStaffDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_STAFF_AVATAR_INVALID",
      message: "پاسخ بارگذاری تصویر معتبر نیست.",
    });
  }
  return view;
}

export async function removeAdminStaffAvatar(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminStaffDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}/avatar`,
    {
      method: "DELETE",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
  const view = adaptAdminStaffDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_STAFF_AVATAR_INVALID",
      message: "پاسخ حذف تصویر معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminStaffImpactPreview(
  reference: string,
  action: AdminStaffImpactAction,
  options: { branchId?: string; serviceId?: string; version?: string } = {},
  signal?: AbortSignal,
): Promise<AdminStaffImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: {
        action,
        branchId: options.branchId,
        serviceId: options.serviceId,
        version: options.version,
      },
    },
  );
  const preview = adaptAdminStaffImpactPreview(payload, action);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_STAFF_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function submitAdminStaffLifecycleAction(
  reference: string,
  action: AdminStaffImpactAction,
  input: {
    previewVersion?: string;
    version?: string;
    branchId?: string;
    serviceId?: string;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminStaffMutationResult> {
  const pathAction =
    action === "activate"
      ? "activate"
      : action === "deactivate"
        ? "deactivate"
        : action === "archive"
          ? "archive"
          : action === "remove_branch"
            ? "branch"
            : action === "remove_service"
              ? "service"
              : "delete";
  const payload = await apiClient<unknown>(
    `/admin/staff/${encodeURIComponent(reference)}/${pathAction}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminStaffMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_STAFF_ACTION_INVALID",
      message: "پاسخ عملیات کارمند معتبر نیست.",
    });
  }
  return result;
}

/** Backend `StaffCreate`/`StaffUpdate` forbid unknown fields; send only what they accept. */
function sanitizeStaffBody(
  input: AdminStaffFormInput,
  mode: "create" | "update",
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
  };
  if (mode === "create") body.resourceTypeId = input.resourceTypeId;
  const optional: Array<[string, string | undefined]> = [
    ["jobTitle", input.jobTitle],
    ["specialty", input.specialty],
    ["description", input.publicDescription],
  ];
  for (const [key, value] of optional) {
    const trimmed = value?.trim();
    if (trimmed) body[key] = trimmed;
  }
  if (input.branchIds.length) body.branchIds = input.branchIds;
  return body;
}

export function adminStaffListQueryOptions(userId: string, filters: AdminStaffListFilters) {
  return {
    queryKey: queryKeys.admin.staffList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminStaffList(filters, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export function adminStaffDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.staffDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminStaffDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export function adminStaffPerformanceQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.staffPerformance(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminStaffPerformance(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 60_000,
    retry: false,
  };
}
