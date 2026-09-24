import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminWaitingListList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "waiting-list", userId] });
}

export function invalidateAdminWaitingListDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.waitingListDetail(userId, reference),
  });
}

export function invalidateAfterAdminWaitingListMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options?: {
    affectsCustomerWaitingList?: boolean;
    affectsAppointments?: boolean;
    affectsAvailability?: boolean;
    availabilityScope?: {
      serviceId?: string;
      providerId?: string;
      branchId?: string;
      date?: string;
    };
  },
) {
  void invalidateAdminWaitingListList(queryClient, userId);
  if (reference) {
    void invalidateAdminWaitingListDetail(queryClient, userId, reference);
    void queryClient.invalidateQueries({
      queryKey: ["admin", "waiting-list", userId, "offer", reference],
    });
    void queryClient.invalidateQueries({
      queryKey: ["admin", "waiting-list", userId, "availability", reference],
    });
  }
  if (options?.affectsCustomerWaitingList) {
    void queryClient.invalidateQueries({ queryKey: ["customer", "waiting-list"] });
  }
  if (options?.affectsAppointments) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
    void queryClient.invalidateQueries({ queryKey: ["customer", "appointments"] });
  }
  if (options?.affectsAvailability && options.availabilityScope) {
    const { serviceId, providerId, branchId, date } = options.availabilityScope;
    void queryClient.invalidateQueries({
      queryKey: [
        "admin",
        "waiting-list",
        userId,
        "availability",
        serviceId ?? "",
        providerId ?? "",
        branchId ?? "",
        date ?? "",
      ],
    });
  }
  void queryClient.invalidateQueries({ queryKey: ["admin", userId, "dashboard"] });
}
