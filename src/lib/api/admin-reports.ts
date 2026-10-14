import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminReportExport,
  adaptAdminReportMeta,
  adaptAdminReportView,
} from "@/lib/admin/report-adapter";
import { filtersToAdminReportParams } from "@/lib/admin/report-filters";
import { queryKeys } from "@/lib/query/keys";
import { EXPORT_JOB_POLL, boundedPollInterval } from "@/lib/query/policies";
import type {
  AdminReportExportView,
  AdminReportListFilters,
  AdminReportMetaView,
  AdminReportView,
} from "@/types/admin-report";

function buildReportQuery(filters: AdminReportListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtersToAdminReportParams(filters))) {
    if (key === "report") continue;
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminReportMeta(
  signal?: AbortSignal,
): Promise<AdminReportMetaView> {
  try {
    const payload = await apiClient<unknown>("/admin/reports/meta", {
      method: "GET",
      signal,
    });
    return adaptAdminReportMeta(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return adaptAdminReportMeta({});
    }
    throw error;
  }
}

export function adminReportMetaQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.reportMeta(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminReportMeta(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export async function fetchAdminReport(
  filters: AdminReportListFilters,
  signal?: AbortSignal,
): Promise<AdminReportView> {
  const query = buildReportQuery(filters);
  const path = query
    ? `/admin/reports/${encodeURIComponent(filters.report)}?${query}`
    : `/admin/reports/${encodeURIComponent(filters.report)}`;
  const payload = await apiClient<unknown>(path, { method: "GET", signal });
  return adaptAdminReportView(payload, filters.report, filters.from, filters.to);
}

export function adminReportQueryOptions(userId: string, filters: AdminReportListFilters) {
  return {
    queryKey: queryKeys.admin.report(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminReport(filters, signal),
    enabled: Boolean(userId) && Boolean(filters.report),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function createAdminReportExport(
  filters: AdminReportListFilters,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminReportExportView> {
  const payload = await apiClient<unknown>("/admin/reports/export", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: filtersToAdminReportParams(filters),
  });
  const view = adaptAdminReportExport(payload, filters.report);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_REPORT_EXPORT_INVALID",
      message: "ایجاد خروجی گزارش نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminReportExport(
  jobId: string,
  reportType: AdminReportListFilters["report"],
  signal?: AbortSignal,
): Promise<AdminReportExportView> {
  const payload = await apiClient<unknown>(
    `/admin/reports/export/${encodeURIComponent(jobId)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminReportExport(payload, reportType);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_REPORT_EXPORT_NOT_FOUND",
      message: "خروجی گزارش پیدا نشد.",
    });
  }
  return view;
}

export function adminReportExportQueryOptions(
  userId: string,
  jobId: string,
  reportType: AdminReportListFilters["report"],
  enabled: boolean,
) {
  return {
    queryKey: queryKeys.admin.reportExport(userId, jobId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminReportExport(jobId, reportType, signal),
    enabled: Boolean(userId) && Boolean(jobId) && enabled,
    staleTime: 0,
    refetchInterval: boundedPollInterval<AdminReportExportView>(
      (data) => data.status === "pending" || data.status === "processing",
      EXPORT_JOB_POLL,
    ),
    retry: false,
  };
}
