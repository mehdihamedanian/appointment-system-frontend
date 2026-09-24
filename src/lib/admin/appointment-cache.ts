import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";
import type { AdminAppointmentActionKey } from "@/types/admin-appointment";

export function invalidateAdminAppointmentList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
}

export function invalidateAdminAppointmentDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admin.appointmentDetail(userId, reference),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admin.appointmentTimeline(userId, reference),
  });
}

function invalidateCustomerAppointmentCaches(queryClient: QueryClient, reference: string) {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "customer" &&
      query.queryKey.includes(reference),
  });
  void queryClient.invalidateQueries({ queryKey: ["customer", "dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["customer", "appointments"] });
}

export function invalidateAfterAdminAppointmentMutation(
  queryClient: QueryClient,
  userId: string,
  reference: string,
  action: AdminAppointmentActionKey,
) {
  invalidateAdminAppointmentDetail(queryClient, userId, reference);
  invalidateAdminAppointmentList(queryClient, userId);
  void invalidateAdminDashboard(queryClient, userId);

  if (action === "complete" || action === "cancel" || action === "markNoShow" || action === "reschedule") {
    invalidateCustomerAppointmentCaches(queryClient, reference);
  }

  if (action === "cancel" || action === "reschedule") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reschedule.all });
  }
}

export function invalidateAfterAdminInternalNote(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  invalidateAdminAppointmentDetail(queryClient, userId, reference);
}

export function invalidateAfterAdminCancellation(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  invalidateAfterAdminAppointmentMutation(queryClient, userId, reference, "cancel");
}
