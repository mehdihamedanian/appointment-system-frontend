import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminCouponDetail,
  adaptAdminCouponImpactPreview,
  adaptAdminCouponList,
  adaptAdminCouponMutationResult,
  sanitizeAdminCouponBody,
} from "@/lib/admin/coupon-adapter";
import { filtersToAdminCouponParams } from "@/lib/admin/coupon-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminCouponDetailView,
  AdminCouponFormInput,
  AdminCouponImpactAction,
  AdminCouponImpactPreview,
  AdminCouponListFilters,
  AdminCouponListView,
  AdminCouponMutationResult,
} from "@/types/admin-coupon";
import { ADMIN_COUPON_LIST_LIMIT } from "@/types/admin-coupon";

function buildListQuery(filters: AdminCouponListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_COUPON_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminCouponParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminCouponList(
  filters: AdminCouponListFilters,
  signal?: AbortSignal,
): Promise<AdminCouponListView> {
  const payload = await apiClient<unknown>(`/admin/coupons?${buildListQuery(filters)}`, {
    method: "GET",
    signal,
  });
  return adaptAdminCouponList(payload, filters);
}

export function adminCouponListQueryOptions(userId: string, filters: AdminCouponListFilters) {
  return {
    queryKey: queryKeys.admin.couponList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminCouponList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchAdminCouponDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminCouponDetailView> {
  const payload = await apiClient<unknown>(`/admin/coupons/${encodeURIComponent(reference)}`, {
    method: "GET",
    signal,
  });
  const view = adaptAdminCouponDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_COUPON_NOT_FOUND",
      message: "کوپن پیدا نشد.",
    });
  }
  return view;
}

export function adminCouponDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.couponDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminCouponDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function createAdminCoupon(
  input: AdminCouponFormInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminCouponDetailView> {
  try {
    const payload = await apiClient<unknown>("/admin/coupons", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: sanitizeAdminCouponBody(input),
    });
    const view = adaptAdminCouponDetail(payload);
    if (!view) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_COUPON_INVALID",
        message: "پاسخ ایجاد کوپن معتبر نیست.",
      });
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_COUPON_ENDPOINT_MISSING",
        message: "ایجاد کوپن هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminCoupon(
  reference: string,
  input: AdminCouponFormInput,
  idempotencyKey: string,
  version?: string,
  signal?: AbortSignal,
): Promise<AdminCouponDetailView> {
  const payload = await apiClient<unknown>(`/admin/coupons/${encodeURIComponent(reference)}`, {
    method: "PATCH",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: sanitizeAdminCouponBody(input, version),
  });
  const view = adaptAdminCouponDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_COUPON_INVALID",
      message: "پاسخ ویرایش کوپن معتبر نیست.",
    });
  }
  return view;
}

export async function fetchAdminCouponImpactPreview(
  reference: string,
  action: AdminCouponImpactAction,
  signal?: AbortSignal,
): Promise<AdminCouponImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/coupons/${encodeURIComponent(reference)}/impact-preview`,
    {
      method: "POST",
      signal,
      body: { action },
    },
  );
  const preview = adaptAdminCouponImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "COUPON_IMPACT_INVALID",
      message: "پیش‌نمایش اثر در دسترس نیست.",
    });
  }
  return preview;
}

export async function submitAdminCouponLifecycleAction(
  reference: string,
  action: AdminCouponImpactAction,
  idempotencyKey: string,
  version?: string,
  signal?: AbortSignal,
): Promise<AdminCouponMutationResult> {
  const path =
    action === "pause"
      ? "pause"
      : action === "activate"
        ? "activate"
        : action === "archive"
          ? "archive"
          : "lifecycle";
  const payload = await apiClient<unknown>(
    `/admin/coupons/${encodeURIComponent(reference)}/${path}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: version ? { version } : {},
    },
  );
  const result = adaptAdminCouponMutationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "COUPON_LIFECYCLE_INVALID",
      message: "عملیات کوپن نامعتبر بود.",
    });
  }
  return result;
}
