import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  adaptAdminActivityLogDetail,
  adaptAdminActivityLogExportJob,
  adaptAdminActivityLogList,
} from "@/lib/admin/activity-log-adapter";
import { filtersToAdminActivityLogParams } from "@/lib/admin/activity-log-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminActivityLogDetailView,
  AdminActivityLogExportJobView,
  AdminActivityLogListFilters,
  AdminActivityLogListView,
} from "@/types/admin-activity-log";
import { ADMIN_ACTIVITY_LOG_LIST_LIMIT } from "@/types/admin-activity-log";

function buildListQuery(filters: AdminActivityLogListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_ACTIVITY_LOG_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminActivityLogParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminActivityLogList(
  filters: AdminActivityLogListFilters,
  signal?: AbortSignal,
): Promise<AdminActivityLogListView> {
  const payload = await apiClient<unknown>(`/admin/activity-logs?${buildListQuery(filters)}`, {
    method: "GET",
    signal,
  });
  return adaptAdminActivityLogList(payload, filters);
}

export function adminActivityLogListQueryOptions(
  userId: string,
  filters: AdminActivityLogListFilters,
) {
  return {
    queryKey: queryKeys.admin.activityLogList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminActivityLogList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    placeholderData: (previous: AdminActivityLogListView | undefined) => previous,
    retry: false,
  };
}

export async function fetchAdminActivityLogDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminActivityLogDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/activity-logs/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminActivityLogDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_ACTIVITY_LOG_NOT_FOUND",
      message: "رویداد پیدا نشد.",
    });
  }
  return view;
}

export function adminActivityLogDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.activityLogDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminActivityLogDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function createAdminActivityLogExport(
  filters: AdminActivityLogListFilters,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminActivityLogExportJobView> {
  const payload = await apiClient<unknown>("/admin/activity-logs/export", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: filtersToAdminActivityLogParams(filters),
  });
  return adaptAdminActivityLogExportJob(payload);
}

export async function fetchAdminActivityLogExport(
  jobId: string,
  signal?: AbortSignal,
): Promise<AdminActivityLogExportJobView> {
  const payload = await apiClient<unknown>(
    `/admin/activity-logs/export/${encodeURIComponent(jobId)}`,
    { method: "GET", signal },
  );
  return adaptAdminActivityLogExportJob(payload);
}

export function adminActivityLogExportQueryOptions(userId: string, jobId: string) {
  return {
    queryKey: queryKeys.admin.activityLogExport(userId, jobId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminActivityLogExport(jobId, signal),
    enabled: Boolean(userId) && Boolean(jobId),
    refetchInterval: (query: { state: { data?: AdminActivityLogExportJobView } }) => {
      const status = query.state.data?.status;
      return status === "preparing" ? 2000 : false;
    },
    retry: false,
  };
}
