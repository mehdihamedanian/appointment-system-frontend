import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminScheduleImpactPreview,
  adaptAdminScheduleMutationResult,
  adaptAdminScheduleView,
  sanitizeWeeklyBody,
} from "@/lib/admin/schedule-adapter";
import { adminScheduleApiPath } from "@/lib/admin/schedule-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminScheduleBlockItem,
  AdminScheduleHolidayItem,
  AdminScheduleImpactPreview,
  AdminScheduleMutationResult,
  AdminScheduleScope,
  AdminScheduleTimeOffItem,
  AdminScheduleView,
  AdminScheduleWeeklyInput,
} from "@/types/admin-schedule";

export type AdminScheduleImpactAction =
  | "update_weekly"
  | "switch_inheritance"
  | "create_holiday"
  | "update_holiday"
  | "delete_holiday"
  | "create_time_off"
  | "delete_time_off"
  | "create_block"
  | "delete_block";

function schedulePath(scope: AdminScheduleScope, reference?: string): string {
  return adminScheduleApiPath(scope, reference);
}

export async function fetchAdminScheduleDetail(
  scope: AdminScheduleScope,
  reference: string | undefined,
  signal?: AbortSignal,
): Promise<AdminScheduleView> {
  const path = schedulePath(scope, reference);
  const payload = await apiClient<unknown>(path, { method: "GET", signal });
  const view = adaptAdminScheduleView(payload, scope, reference);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_SCHEDULE_NOT_FOUND",
      message: "زمان‌بندی پیدا نشد.",
    });
  }
  return view;
}

export async function fetchAdminScheduleHolidays(
  signal?: AbortSignal,
): Promise<AdminScheduleHolidayItem[]> {
  try {
    const payload = await apiClient<unknown>("/admin/schedules/holidays", {
      method: "GET",
      signal,
    });
    const view = adaptAdminScheduleView(
      { holidays: payload, effective: { inheritanceMode: "custom" }, weekly: [] },
      "business",
    );
    return view?.holidays ?? [];
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return [];
    }
    throw error;
  }
}

export async function previewAdminScheduleImpact(
  scope: AdminScheduleScope,
  reference: string | undefined,
  action: AdminScheduleImpactAction,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminScheduleImpactPreview> {
  const path = `${schedulePath(scope, reference)}/impact-preview`;
  try {
    const payload = await apiClient<unknown>(path, {
      method: "POST",
      signal,
      body: { action, ...body },
    });
    const preview = adaptAdminScheduleImpactPreview(payload);
    if (!preview) {
      throw new ApiError({
        status: 422,
        code: "ADMIN_SCHEDULE_PREVIEW_INVALID",
        message: "پاسخ پیش‌نمایش تأثیر معتبر نیست.",
      });
    }
    return preview;
  } catch (error) {
    const appError = toAppApiError(error);
    if (isNotFoundError(appError)) {
      throw new ApiError({
        status: 404,
        code: "ADMIN_SCHEDULE_PREVIEW_MISSING",
        message: "پیش‌نمایش تأثیر هنوز به سرویس متصل نشده است.",
      });
    }
    throw error;
  }
}

export async function updateAdminScheduleWeekly(
  scope: AdminScheduleScope,
  reference: string | undefined,
  input: AdminScheduleWeeklyInput,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<AdminScheduleMutationResult> {
  const path = schedulePath(scope, reference);
  const payload = await apiClient<unknown>(path, {
    method: "PUT",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      ...sanitizeWeeklyBody(input),
      previewVersion,
    },
  });
  return adaptAdminScheduleMutationResult(payload, scope, reference);
}

export async function createAdminScheduleHoliday(
  body: Record<string, unknown>,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<AdminScheduleHolidayItem> {
  const payload = await apiClient<unknown>("/admin/schedules/holidays", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { ...body, previewVersion },
  });
  const view = adaptAdminScheduleView({ holidays: [payload] }, "business");
  const item = view?.holidays[0];
  if (!item) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SCHEDULE_HOLIDAY_INVALID",
      message: "پاسخ ایجاد تعطیلات معتبر نیست.",
    });
  }
  return item;
}

export async function deleteAdminScheduleHoliday(
  holidayId: string,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiClient<unknown>(`/admin/schedules/holidays/${encodeURIComponent(holidayId)}`, {
    method: "DELETE",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: previewVersion ? { previewVersion } : undefined,
  });
}

export async function createAdminScheduleTimeOff(
  scope: AdminScheduleScope,
  reference: string | undefined,
  body: Record<string, unknown>,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<AdminScheduleTimeOffItem> {
  const path = `${schedulePath(scope, reference)}/time-off`;
  const payload = await apiClient<unknown>(path, {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { ...body, previewVersion },
  });
  const view = adaptAdminScheduleView({ timeOff: [payload] }, scope, reference);
  const item = view?.timeOff[0];
  if (!item) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SCHEDULE_TIME_OFF_INVALID",
      message: "پاسخ ثبت مرخصی معتبر نیست.",
    });
  }
  return item;
}

export async function deleteAdminScheduleTimeOff(
  scope: AdminScheduleScope,
  reference: string | undefined,
  timeOffId: string,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<void> {
  const path = `${schedulePath(scope, reference)}/time-off/${encodeURIComponent(timeOffId)}`;
  await apiClient<unknown>(path, {
    method: "DELETE",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: previewVersion ? { previewVersion } : undefined,
  });
}

export async function createAdminScheduleBlock(
  scope: AdminScheduleScope,
  reference: string | undefined,
  body: Record<string, unknown>,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<AdminScheduleBlockItem> {
  const path = `${schedulePath(scope, reference)}/blocks`;
  const payload = await apiClient<unknown>(path, {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { ...body, previewVersion },
  });
  const view = adaptAdminScheduleView({ blocks: [payload] }, scope, reference);
  const item = view?.blocks[0];
  if (!item) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_SCHEDULE_BLOCK_INVALID",
      message: "پاسخ ثبت مسدودی معتبر نیست.",
    });
  }
  return item;
}

export async function deleteAdminScheduleBlock(
  scope: AdminScheduleScope,
  reference: string | undefined,
  blockId: string,
  idempotencyKey: string,
  previewVersion?: string,
  signal?: AbortSignal,
): Promise<void> {
  const path = `${schedulePath(scope, reference)}/blocks/${encodeURIComponent(blockId)}`;
  await apiClient<unknown>(path, {
    method: "DELETE",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: previewVersion ? { previewVersion } : undefined,
  });
}

export function adminScheduleDetailQueryOptions(
  userId: string,
  scope: AdminScheduleScope,
  reference?: string,
) {
  return {
    queryKey: queryKeys.admin.scheduleDetail(userId, scope, reference),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminScheduleDetail(scope, reference, signal),
    staleTime: 30_000,
  };
}

export function adminScheduleHolidaysQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.scheduleHolidays(userId),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminScheduleHolidays(signal),
    staleTime: 30_000,
  };
}

export function adminScheduleHubQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.scheduleHub(userId),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminScheduleDetail("business", undefined, signal),
    staleTime: 60_000,
  };
}
