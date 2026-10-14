import { apiClient } from "@/lib/api/client";
import { toAppApiError } from "@/lib/api/errors";
import {
  adaptDashboardSummary,
  RECENT_APPOINTMENTS_LIMIT,
  type DashboardSectionResult,
} from "@/lib/admin/dashboard-adapter";
import {
  analyticsRangeQueryParams,
  defaultOperationalDate,
  operationalDayQueryParams,
} from "@/lib/admin/dashboard-filters";
import { unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { AdminDashboardFilters, AdminDashboardView } from "@/types/admin-dashboard";

const SUMMARY_PATH = "/admin/dashboard/summary";

async function settle(task: () => Promise<unknown>): Promise<DashboardSectionResult> {
  try {
    return { ok: true, payload: await task() };
  } catch (error) {
    return { ok: false, error: toAppApiError(error) };
  }
}

function readPeriodBounds(payload: unknown): { start: string; end: string } | undefined {
  const root = unwrapPayload(payload);
  const period = isRecord(root) && isRecord(root.period) ? root.period : undefined;
  const start = readString(period?.start);
  const end = readString(period?.end);
  return start && end ? { start, end } : undefined;
}

export async function fetchAdminDashboard(
  filters: AdminDashboardFilters,
  signal?: AbortSignal,
  fallbackTimezone?: string,
): Promise<AdminDashboardView> {
  const analyticsPromise = settle(() =>
    apiClient<unknown>(SUMMARY_PATH, {
      method: "GET",
      signal,
      query: analyticsRangeQueryParams(filters),
    }),
  );

  const day = await apiClient<unknown>(SUMMARY_PATH, {
    method: "GET",
    signal,
    query: operationalDayQueryParams(filters),
  });

  // The summary resolves the local day in the business timezone; reuse those bounds.
  const bounds = readPeriodBounds(day);
  const recentPromise: Promise<DashboardSectionResult> = bounds
    ? settle(() =>
        apiClient<unknown>("/admin/appointments", {
          method: "GET",
          signal,
          query: {
            starts_from: bounds.start,
            starts_to: bounds.end,
            branch_id: filters.branchId,
            page: 1,
            page_size: RECENT_APPOINTMENTS_LIMIT,
          },
        }),
      )
    : Promise.resolve({
        ok: false,
        error: { status: 0, message: "بازه زمانی روز عملیاتی از Backend دریافت نشد." },
      });

  const [analytics, recent] = await Promise.all([analyticsPromise, recentPromise]);
  const fallbackDate = filters.date || defaultOperationalDate(fallbackTimezone);
  return adaptDashboardSummary({ day, analytics, recent }, fallbackDate);
}

/** Business timezone from `GET /admin/settings`, which the Backend restricts to settings readers. */
export async function fetchBusinessTimezone(signal?: AbortSignal): Promise<string | undefined> {
  const payload = await apiClient<unknown>("/admin/settings", { method: "GET", signal });
  const root = unwrapPayload(payload);
  const business = isRecord(root) && isRecord(root.business) ? root.business : undefined;
  return readString(business?.timezone);
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
