import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminServiceResourceRequirements(
  queryClient: QueryClient,
  userId: string,
  serviceReference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.serviceResourceRequirements(userId, serviceReference),
  });
}

export function invalidateAfterServiceResourceRequirementsMutation(
  queryClient: QueryClient,
  userId: string,
  serviceReference: string,
  options: { affectsPublicAvailability?: boolean } = {},
) {
  invalidateAdminServiceResourceRequirements(queryClient, userId, serviceReference);
  void queryClient.invalidateQueries({ queryKey: ["admin", "services", userId] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "resources", userId] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "staff", userId] });
  void invalidateAdminDashboard(queryClient, userId);

  if (options.affectsPublicAvailability) {
    void queryClient.invalidateQueries({ queryKey: ["public", "services"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProviders });
  }
}
