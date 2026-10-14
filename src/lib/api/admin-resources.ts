import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminResourceDetail,
  adaptAdminResourceImpactPreview,
  adaptAdminResourceList,
  adaptAdminResourceMutationResult,
  adaptAdminResourceTypeOptions,
} from "@/lib/admin/resource-adapter";
import { filtersToAdminResourceParams } from "@/lib/admin/resource-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminResourceDetailView,
  AdminResourceFormInput,
  AdminResourceImpactAction,
  AdminResourceImpactPreview,
  AdminResourceListFilters,
  AdminResourceListView,
  AdminResourceMutationResult,
  AdminResourceTypeOption,
} from "@/types/admin-resource";
import { ADMIN_RESOURCE_LIST_LIMIT } from "@/types/admin-resource";

function buildListQuery(filters: AdminResourceListFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToAdminResourceParams(filters);
  params.set("limit", String(ADMIN_RESOURCE_LIST_LIMIT));
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminResources(
  filters: AdminResourceListFilters,
  signal?: AbortSignal,
): Promise<AdminResourceListView> {
  const query = buildListQuery(filters);
  const payload = await apiClient<unknown>(`/admin/resources?${query}`, {
    method: "GET",
    signal,
  });
  return adaptAdminResourceList(payload, filters.page);
}

export async function fetchAdminResourceDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminResourceDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/resources/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminResourceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_RESOURCE_NOT_FOUND",
      message: "منبع پیدا نشد.",
    });
  }
  return view;
}

export async function createAdminResource(
  input: AdminResourceFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminResourceDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/resources", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeResourceBody(input, "create"),
    });
    const view = adaptAdminResourceDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_RESOURCE_INVALID",
        message: "پاسخ ایجاد منبع معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_RESOURCE_ENDPOINT_MISSING",
        message: "ایجاد منبع هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminResource(
  reference: string,
  input: AdminResourceFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminResourceDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/resources/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeResourceBody(input, "update"),
    },
  );
  const view = adaptAdminResourceDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_RESOURCE_INVALID",
      message: "پاسخ ویرایش منبع معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminResourceImpactPreview(
  reference: string,
  action: AdminResourceImpactAction,
  options: { branchId?: string; version?: string } = {},
  signal?: AbortSignal,
): Promise<AdminResourceImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/resources/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: {
        action,
        branchId: options.branchId,
        version: options.version,
      },
    },
  );
  const preview = adaptAdminResourceImpactPreview(payload, action);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_RESOURCE_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function submitAdminResourceLifecycleAction(
  reference: string,
  action: AdminResourceImpactAction,
  input: { previewVersion?: string; version?: string; branchId?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminResourceMutationResult> {
  const pathAction =
    action === "change_branch"
      ? "branch"
      : action === "activate"
        ? "activate"
        : action === "deactivate"
          ? "deactivate"
          : action === "archive"
            ? "archive"
            : "delete";
  const payload = await apiClient<unknown>(
    `/admin/resources/${encodeURIComponent(reference)}/${pathAction}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const result = adaptAdminResourceMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_RESOURCE_ACTION_INVALID",
      message: "پاسخ عملیات منبع معتبر نیست.",
    });
  }
  return result;
}

/** Backend `ResourceCreate`/`ResourceUpdate` forbid unknown fields; send only what they accept. */
function sanitizeResourceBody(
  input: AdminResourceFormInput,
  mode: "create" | "update",
): Record<string, unknown> {
  const body: Record<string, unknown> = { name: input.name.trim() };
  if (mode === "create") body.resourceTypeId = input.resourceTypeId;
  const description = input.description?.trim();
  if (description) body.description = description;
  if (typeof input.capacity === "number" && Number.isFinite(input.capacity)) {
    body.capacity = input.capacity;
  }
  if (input.branchId) body.branchIds = [input.branchId];
  return body;
}

export async function fetchAdminResourceTypes(
  signal?: AbortSignal,
): Promise<AdminResourceTypeOption[]> {
  const payload = await apiClient<unknown>("/admin/resources/types", { method: "GET", signal });
  return adaptAdminResourceTypeOptions(payload);
}

export function adminResourceTypesQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.resourceTypes(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminResourceTypes(signal),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    retry: false,
  };
}

export function adminResourceListQueryOptions(
  userId: string,
  filters: AdminResourceListFilters,
) {
  return {
    queryKey: queryKeys.admin.resourceList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminResources(filters, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export function adminResourceDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.resourceDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminResourceDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}
