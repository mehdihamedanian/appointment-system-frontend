import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";
import type { AdminServiceFormImpactField } from "@/types/admin-service";

export function invalidateAdminServiceList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "services", userId] });
}

export function invalidateAdminServiceDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.serviceDetail(userId, reference),
  });
}

export function invalidateAfterAdminServiceMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options: {
    affectsPublicCatalog?: boolean;
    affectsAvailability?: boolean;
    affectsProviders?: boolean;
    affectsManualBooking?: boolean;
    changedFields?: AdminServiceFormImpactField[];
  } = {},
) {
  invalidateAdminServiceList(queryClient, userId);
  if (reference) {
    invalidateAdminServiceDetail(queryClient, userId, reference);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.serviceResourceRequirements(userId, reference),
    });
  }

  const schedulingChanged =
    options.affectsAvailability === true ||
    (options.changedFields?.some((field) =>
      ["duration", "buffers", "capacity", "branches", "providers", "requirements", "status"].includes(
        field,
      ),
    ) ??
      false);

  if (schedulingChanged) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  }

  if (options.affectsManualBooking !== false && schedulingChanged) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
  }

  if (options.affectsPublicCatalog !== false) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicServices });
    void queryClient.invalidateQueries({ queryKey: ["public", "services"] });
  }

  if (options.affectsProviders) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProviders });
    void queryClient.invalidateQueries({ queryKey: ["public", "providers"] });
  }

  void queryClient.invalidateQueries({ queryKey: ["admin", "staff", userId] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "resources", userId] });
  void invalidateAdminDashboard(queryClient, userId);
}
