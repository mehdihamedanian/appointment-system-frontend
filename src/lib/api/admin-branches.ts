import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminBranchDetail,
  adaptAdminBranchImpactPreview,
  adaptAdminBranchList,
  adaptAdminBranchMutationResult,
  sanitizeAdminBranchBody,
} from "@/lib/admin/branch-adapter";
import { filtersToAdminBranchParams } from "@/lib/admin/branch-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminBranchDetailView,
  AdminBranchFormInput,
  AdminBranchImpactAction,
  AdminBranchImpactPreview,
  AdminBranchListFilters,
  AdminBranchListView,
  AdminBranchMutationResult,
} from "@/types/admin-branch";
import { ADMIN_BRANCH_LIST_LIMIT } from "@/types/admin-branch";

function buildListQuery(filters: AdminBranchListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminBranchParams(filters);
  params.set("limit", String(ADMIN_BRANCH_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminBranchList(
  filters: AdminBranchListFilters,
  signal?: AbortSignal,
): Promise<AdminBranchListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/branches?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminBranchList(payload, filters.page);
}

export async function fetchAdminBranchDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminBranchDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/branches/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminBranchDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_BRANCH_NOT_FOUND",
      message: "شعبه پیدا نشد.",
    });
  }
  return view;
}

export async function createAdminBranch(
  input: AdminBranchFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminBranchDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/branches", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminBranchBody(input),
    });
    const view = adaptAdminBranchDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_BRANCH_INVALID",
        message: "پاسخ ایجاد شعبه معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_BRANCH_ENDPOINT_MISSING",
        message: "ایجاد شعبه هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminBranch(
  reference: string,
  input: AdminBranchFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminBranchDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/branches/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminBranchBody(input),
    },
  );
  const view = adaptAdminBranchDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_BRANCH_INVALID",
      message: "پاسخ ویرایش شعبه معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminBranchImpactPreview(
  reference: string,
  action: AdminBranchImpactAction,
  options: {
    staffId?: string;
    resourceId?: string;
    serviceId?: string;
    version?: string;
  } = {},
  signal?: AbortSignal,
): Promise<AdminBranchImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/branches/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: {
        action,
        staffId: options.staffId,
        resourceId: options.resourceId,
        serviceId: options.serviceId,
        version: options.version,
      },
    },
  );
  const preview = adaptAdminBranchImpactPreview(payload, action);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_BRANCH_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function submitAdminBranchLifecycleAction(
  reference: string,
  action: Extract<AdminBranchImpactAction, "activate" | "deactivate" | "archive" | "delete">,
  input: { previewVersion?: string; version?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminBranchMutationResult> {
  const payload = await apiClient<unknown>(
    `/admin/branches/${encodeURIComponent(reference)}/${action}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminBranchMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_BRANCH_ACTION_INVALID",
      message: "پاسخ عملیات شعبه معتبر نیست.",
    });
  }
  return result;
}

export async function submitAdminBranchAssignmentAction(
  reference: string,
  action: AdminBranchImpactAction,
  input: {
    staffId?: string;
    resourceId?: string;
    serviceId?: string;
    previewVersion?: string;
    version?: string;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminBranchMutationResult> {
  const pathAction =
    action === "assign_staff"
      ? "staff"
      : action === "remove_staff"
        ? "staff/remove"
        : action === "assign_resource"
          ? "resources"
          : action === "transfer_resource"
            ? "resources/transfer"
            : action === "remove_resource"
              ? "resources/remove"
              : action === "assign_service"
                ? "services"
                : "services/remove";

  const payload = await apiClient<unknown>(
    `/admin/branches/${encodeURIComponent(reference)}/${pathAction}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminBranchMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_BRANCH_ASSIGNMENT_INVALID",
      message: "پاسخ تخصیص شعبه معتبر نیست.",
    });
  }
  return result;
}

export function adminBranchListQueryOptions(userId: string, filters: AdminBranchListFilters) {
  return {
    queryKey: queryKeys.admin.branchList(userId, filters),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminBranchList(filters, signal),
    staleTime: 30_000,
  };
}

export function adminBranchDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.branchDetail(userId, reference),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminBranchDetail(reference, signal),
    staleTime: 30_000,
  };
}
