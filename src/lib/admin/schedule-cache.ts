import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";
import type { AdminScheduleScope } from "@/types/admin-schedule";

export function invalidateAdminScheduleDetail(
  queryClient: QueryClient,
  userId: string,
  scope: AdminScheduleScope,
  reference?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.scheduleDetail(userId, scope, reference),
  });
}

export function invalidateAfterAdminScheduleMutation(
  queryClient: QueryClient,
  userId: string,
  scope: AdminScheduleScope,
  reference?: string,
  options: {
    affectsAvailability?: boolean;
    affectsCalendar?: boolean;
    affectsManualBooking?: boolean;
    affectsPublicHours?: boolean;
  } = {},
) {
  void invalidateAdminScheduleDetail(queryClient, userId, scope, reference);
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.scheduleHub(userId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.scheduleHolidays(userId) });

  const affectsAvailability = options.affectsAvailability !== false;
  const affectsCalendar = options.affectsCalendar !== false;

  if (affectsAvailability) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  }
  if (affectsCalendar) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  }
  if (options.affectsManualBooking !== false && affectsAvailability) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  }
  if (options.affectsPublicHours) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
  }

  if (scope === "staff" && reference) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.staffDetail(userId, reference),
    });
  }
  if (scope === "resource" && reference) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.resourceDetail(userId, reference),
    });
  }
  if (scope === "branch" && reference) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "branches", userId] });
  }

  void invalidateAdminDashboard(queryClient, userId);
}
