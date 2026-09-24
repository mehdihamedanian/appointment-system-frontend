import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminResourceList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "resources", userId] });
}

export function invalidateAdminResourceDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.resourceDetail(userId, reference),
  });
}

export function invalidateAfterAdminResourceMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options: { affectsCustomerVisibleProvider?: boolean } = {},
) {
  invalidateAdminResourceList(queryClient, userId);
  if (reference) {
    invalidateAdminResourceDetail(queryClient, userId, reference);
  }
  void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  void invalidateAdminDashboard(queryClient, userId);

  if (options.affectsCustomerVisibleProvider) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProviders });
    void queryClient.invalidateQueries({ queryKey: ["public", "providers"] });
  }
}
