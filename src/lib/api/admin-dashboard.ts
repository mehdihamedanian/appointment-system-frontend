import { apiClient } from "@/lib/api/client";
import { adaptAdminDashboard } from "@/lib/admin/dashboard-adapter";
import {
  defaultOperationalDate,
  filtersToQueryParams,
} from "@/lib/admin/dashboard-filters";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { AdminDashboardFilters, AdminDashboardView } from "@/types/admin-dashboard";

function buildSearchParams(filters: AdminDashboardFilters): string {
  const params = new URLSearchParams();
  const mapped = filtersToQueryParams(filters);
  for (const [key, value] of Object.entries(mapped)) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminDashboard(
  filters: AdminDashboardFilters,
  signal?: AbortSignal,
  fallbackTimezone?: string,
): Promise<AdminDashboardView> {
  const query = buildSearchParams(filters);
  const path = query ? `/admin/dashboard?${query}` : "/admin/dashboard";
  const payload = await apiClient<unknown>(path, {
    method: "GET",
    signal,
  });
  const fallbackDate = defaultOperationalDate(
    fallbackTimezone,
    filters.date ? new Date(`${filters.date}T12:00:00`) : new Date(),
  );
  return adaptAdminDashboard(payload, fallbackDate);
}

export function invalidateAdminDashboard(
  queryClient: QueryClient,
  userId: string,
  filters?: AdminDashboardFilters,
) {
  if (filters) {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.admin.dashboard(userId, filters),
    });
  }
  return queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", userId] });
}

export function adminDashboardQueryOptions(
  userId: string,
  filters: AdminDashboardFilters,
  timezone?: string,
) {
  return {
    queryKey: queryKeys.admin.dashboard(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminDashboard(filters, signal, timezone),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  };
}
