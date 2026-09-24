import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminServiceResourceRequirements,
  adaptEligibleResources,
  adaptServiceResourceRequirementsImpactPreview,
  adaptServiceResourceRequirementsSaveResult,
  sanitizeRequirementsPayload,
} from "@/lib/admin/service-resource-requirement-adapter";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminEligibleResourcesView,
  AdminServiceResourceRequirementsImpactPreview,
  AdminServiceResourceRequirementsInput,
  AdminServiceResourceRequirementsSaveResult,
  AdminServiceResourceRequirementsView,
} from "@/types/admin-service-resource-requirement";
import type { AdminResourceType } from "@/types/admin-resource";

export async function fetchAdminServiceResourceRequirements(
  serviceReference: string,
  signal?: AbortSignal,
): Promise<AdminServiceResourceRequirementsView> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(serviceReference)}/resource-requirements`,
    { method: "GET", signal },
  );
  const view = adaptAdminServiceResourceRequirements(serviceReference, payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_SERVICE_RESOURCE_REQUIREMENTS_NOT_FOUND",
      message: "نیازمندی‌های منبع این خدمت پیدا نشد.",
    });
  }
  return view;
}

export async function fetchEligibleResourcesForRequirement(
  serviceReference: string,
  params: { type: AdminResourceType; branchId?: string },
  signal?: AbortSignal,
): Promise<AdminEligibleResourcesView> {
  const query = new URLSearchParams();
  if (params.type !== "unknown") query.set("type", params.type);
  if (params.branchId) query.set("branchId", params.branchId);
  try {
    const payload = await apiClient<unknown>(
      `/admin/services/${encodeURIComponent(serviceReference)}/resource-requirements/eligible-resources?${query.toString()}`,
      { method: "GET", signal },
    );
    return adaptEligibleResources(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { items: [], selectionSemantics: "unknown" };
    }
    throw error;
  }
}

export async function fetchAdminServiceResourceRequirementsImpactPreview(
  serviceReference: string,
  input: AdminServiceResourceRequirementsInput,
  signal?: AbortSignal,
): Promise<AdminServiceResourceRequirementsImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/services/${encodeURIComponent(serviceReference)}/resource-requirements/impact-preview`,
    {
      method: "POST",
      signal,
      body: sanitizeRequirementsPayload(input),
    },
  );
  const preview = adaptServiceResourceRequirementsImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SERVICE_RESOURCE_IMPACT_INVALID",
      message: "پیش‌نمایش اثر تغییر معتبر نیست.",
    });
  }
  return preview;
}

export async function saveAdminServiceResourceRequirements(
  serviceReference: string,
  input: AdminServiceResourceRequirementsInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminServiceResourceRequirementsSaveResult> {
  try {
    const payload = await apiClient<unknown>(
      `/admin/services/${encodeURIComponent(serviceReference)}/resource-requirements`,
      {
        method: "PUT",
        signal,
        headers: { "Idempotency-Key": idempotencyKey },
        body: sanitizeRequirementsPayload(input),
      },
    );
    const result = adaptServiceResourceRequirementsSaveResult(payload);
    if (!result) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_SERVICE_RESOURCE_SAVE_INVALID",
        message: "پاسخ ذخیره نیازمندی‌ها معتبر نیست.",
      });
    }
    return result;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_SERVICE_RESOURCE_ENDPOINT_MISSING",
        message: "ذخیره نیازمندی‌های منبع هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export function adminServiceResourceRequirementsQueryOptions(
  userId: string,
  serviceReference: string,
) {
  return {
    queryKey: queryKeys.admin.serviceResourceRequirements(userId, serviceReference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminServiceResourceRequirements(serviceReference, signal),
    enabled: Boolean(userId) && Boolean(serviceReference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}
