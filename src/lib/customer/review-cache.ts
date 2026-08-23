import { invalidateCustomerDashboard } from "@/lib/api/customer";
import { invalidateCustomerAppointmentDetail } from "@/lib/api/appointments";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";

export function invalidateAfterReviewSubmit(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  void invalidateCustomerAppointmentDetail(queryClient, userId, reference);
  void invalidateCustomerDashboard(queryClient, userId);
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.appointmentReview(userId, reference),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.notifications(userId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.notificationUnreadCount(userId),
  });
}
