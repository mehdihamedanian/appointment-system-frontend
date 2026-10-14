import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminServiceResourceRequirements,
  adaptEligibleResources,
  adaptServiceResourceRequirementsSaveResult,
  sanitizeRequirementsPayload,
} from "@/lib/admin/service-resource-requirement-adapter";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminEligibleResourcesView,
  AdminServiceResourceRequirementsInput,
  AdminServiceResourceRequirementsSaveResult,
  AdminServiceResourceRequirementsView,
} from "@/types/admin-service-resource-requirement";

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

/** Upper bound of one resource-list page; enough for the resources of a single type. */
const PINNABLE_RESOURCES_PAGE_SIZE = 100;

/**
 * Active resources of one type that may be pinned to a requirement. The Backend's own
 * eligible-resources route needs a saved requirement id, so drafts read the typed list;
 * the Backend still validates the type match on save.
 */
export async function fetchEligibleResourcesForRequirement(
  resourceTypeId: string,
  signal?: AbortSignal,
): Promise<AdminEligibleResourcesView> {
  const payload = await apiClient<unknown>("/resources", {
    method: "GET",
    signal,
    query: {
      resource_type_id: resourceTypeId,
      is_active: "true",
      page_size: PINNABLE_RESOURCES_PAGE_SIZE,
    },
  });
  return adaptEligibleResources(payload);
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
