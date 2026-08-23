import { invalidateCustomerDashboard } from "@/lib/api/customer";
import { invalidateCustomerAppointmentDetail } from "@/lib/api/appointments";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";

export function invalidateAfterCancellation(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  void invalidateCustomerAppointmentDetail(queryClient, userId, reference);
  void invalidateCustomerDashboard(queryClient, userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
  void queryClient.removeQueries({ queryKey: queryKeys.availability.all });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.appointmentCancellationPreview(userId, reference),
  });
}
