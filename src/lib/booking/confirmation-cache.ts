import { invalidateCustomerDashboard } from "@/lib/api/customer";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";

export function invalidateAfterBookingResult(queryClient: QueryClient, userId?: string) {
  void queryClient.removeQueries({ queryKey: queryKeys.availability.all });
  void queryClient.removeQueries({ queryKey: ["booking", "quote"] });
  if (!userId) {
    return;
  }
  void invalidateCustomerDashboard(queryClient, userId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.appointments(userId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
}
