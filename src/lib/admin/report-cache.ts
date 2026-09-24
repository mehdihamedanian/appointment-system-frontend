import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { AdminReportListFilters, AdminReportType } from "@/types/admin-report";

export function invalidateAdminReportMeta(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.reportMeta(userId),
  });
}

export function invalidateAdminReport(
  queryClient: QueryClient,
  userId: string,
  reportType?: AdminReportType,
  filters?: AdminReportListFilters,
) {
  if (filters) {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.admin.report(userId, filters),
    });
  }
  if (reportType) {
    return queryClient.invalidateQueries({
      queryKey: ["admin", "reports", userId, reportType],
    });
  }
  return queryClient.invalidateQueries({ queryKey: ["admin", "reports", userId] });
}

export function clearAdminReportCaches(queryClient: QueryClient, userId?: string) {
  if (userId) {
    void queryClient.removeQueries({ queryKey: ["admin", "reports", userId] });
    return;
  }
  void queryClient.removeQueries({ queryKey: ["admin", "reports"] });
}

export function invalidateAfterAdminReportExport(
  queryClient: QueryClient,
  userId: string,
  jobId?: string,
) {
  if (jobId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.reportExport(userId, jobId),
    });
  }
}
