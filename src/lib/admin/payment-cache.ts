import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminPaymentList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "payments", userId] });
}

export function invalidateAdminPaymentDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.paymentDetail(userId, reference),
  });
}

export function invalidateAfterAdminPaymentMutation(
  queryClient: QueryClient,
  userId: string,
  options: {
    paymentReference?: string;
    appointmentReference?: string;
    customerReference?: string;
    affectsRevenue?: boolean;
  } = {},
) {
  void invalidateAdminPaymentList(queryClient, userId);
  if (options.paymentReference) {
    void invalidateAdminPaymentDetail(queryClient, userId, options.paymentReference);
  }
  if (options.appointmentReference) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.appointmentDetail(userId, options.appointmentReference),
    });
    void queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  }
  if (options.customerReference) {
    void queryClient.invalidateQueries({
      queryKey: ["admin", "customers", userId, "payments", options.customerReference],
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.customerDetail(userId, options.customerReference),
    });
  }
  if (options.affectsRevenue !== false) {
    void queryClient.invalidateQueries({
      queryKey: ["admin", "payments", userId, "revenue"],
    });
    void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", userId] });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
}
