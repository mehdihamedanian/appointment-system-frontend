import { apiClient } from "@/lib/api/client";
import { adaptAdminCalendarView } from "@/lib/admin/calendar-adapter";
import {
  filtersToAdminCalendarParams,
} from "@/lib/admin/calendar-filters";
import { visibleRangeFor } from "@/lib/admin/calendar-range";
import { queryKeys } from "@/lib/query/keys";
import { OPERATIONAL_VIEW_POLL, boundedPollInterval } from "@/lib/query/policies";
import type { AdminCalendarState, AdminCalendarView } from "@/types/admin-calendar";

export async function fetchAdminCalendar(
  state: AdminCalendarState,
  options: {
    timezone?: string;
    weekStartsOn?: number;
    canViewBlockReason?: boolean;
  } = {},
  signal?: AbortSignal,
): Promise<AdminCalendarView> {
  const weekStartsOn = options.weekStartsOn ?? 6;
  const range = visibleRangeFor(state.date, state.range, weekStartsOn);
  const query = filtersToAdminCalendarParams(state, weekStartsOn);
  if (options.timezone) {
    query.timezone = options.timezone;
  }
  const payload = await apiClient<unknown>("/admin/calendar", {
    method: "GET",
    signal,
    query,
  });
  return adaptAdminCalendarView(payload, range, {
    canViewBlockReason: options.canViewBlockReason,
  });
}

export function adminCalendarQueryOptions(
  userId: string,
  state: AdminCalendarState,
  options: {
    timezone?: string;
    weekStartsOn?: number;
    canViewBlockReason?: boolean;
  } = {},
) {
  const weekStartsOn = options.weekStartsOn ?? 6;
  const { from, to } = visibleRangeFor(state.date, state.range, weekStartsOn);
  return {
    queryKey: queryKeys.admin.calendar(userId, {
      from,
      to,
      range: state.range,
      grouping: state.grouping,
      timezone: options.timezone ?? "",
      branchId: state.branchId,
      staffId: state.staffId,
      resourceId: state.resourceId,
      resourceType: state.resourceType,
      serviceId: state.serviceId,
      status: state.status,
      paymentStatus: state.paymentStatus,
    }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminCalendar(state, options, signal),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: boundedPollInterval<AdminCalendarView>(() => true, OPERATIONAL_VIEW_POLL),
    retry: false,
  };
}
