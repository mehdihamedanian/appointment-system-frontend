import { invalidateCustomerDashboard } from "@/lib/api/customer";
import { invalidateCustomerAppointmentDetail } from "@/lib/api/appointments";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";

export function invalidateAfterReschedule(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  void invalidateCustomerAppointmentDetail(queryClient, userId, reference);
  void invalidateCustomerDashboard(queryClient, userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
  void queryClient.removeQueries({ queryKey: queryKeys.availability.all });
  void queryClient.removeQueries({ queryKey: queryKeys.reschedule.all });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.appointmentReschedulePreview(userId, reference),
  });
}
