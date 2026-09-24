import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { invalidateAdminAppointmentList } from "@/lib/admin/appointment-cache";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAfterAdminManualBooking(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  invalidateAdminAppointmentList(queryClient, userId);
  void invalidateAdminDashboard(queryClient, userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  void queryClient.invalidateQueries({ queryKey: ["customer", "appointments"] });
  void queryClient.invalidateQueries({ queryKey: ["customer", "dashboard"] });
  if (reference) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.appointmentDetail(userId, reference),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.appointmentTimeline(userId, reference),
    });
  }
}
