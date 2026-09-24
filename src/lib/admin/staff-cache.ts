import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminStaffList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "staff", userId] });
}

export function invalidateAdminStaffDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.staffDetail(userId, reference),
  });
}

export function invalidateAfterAdminStaffMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options: {
    affectsCustomerVisibleProvider?: boolean;
    affectsBookableProvider?: boolean;
    affectsServiceAssignment?: boolean;
  } = {},
) {
  invalidateAdminStaffList(queryClient, userId);
  if (reference) {
    invalidateAdminStaffDetail(queryClient, userId, reference);
  }
  void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "resources", userId] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });

  if (options.affectsServiceAssignment) {
    void queryClient.invalidateQueries({ queryKey: ["public", "services"] });
  }

  if (options.affectsCustomerVisibleProvider || options.affectsBookableProvider) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProviders });
    void queryClient.invalidateQueries({ queryKey: ["public", "providers"] });
  }

  void invalidateAdminDashboard(queryClient, userId);
}
