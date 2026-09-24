import type { QueryClient } from "@tanstack/react-query";
import { invalidateAdminDashboard } from "@/lib/api/admin-dashboard";
import { queryKeys } from "@/lib/query/keys";
import type { AdminBranchFormImpactField } from "@/types/admin-branch";

export function invalidateAdminBranchList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "branches", userId] });
}

export function invalidateAdminBranchDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.branchDetail(userId, reference),
  });
}

export function invalidateAfterAdminBranchMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options: {
    changedFields?: AdminBranchFormImpactField[];
    affectsPublicCatalog?: boolean;
    affectsAvailability?: boolean;
    affectsAssignments?: boolean;
    lifecycleChanged?: boolean;
  } = {},
) {
  void invalidateAdminBranchList(queryClient, userId);
  if (reference) {
    void invalidateAdminBranchDetail(queryClient, userId, reference);
  }

  const contactOnly =
    options.changedFields?.length &&
    options.changedFields.every((field) => ["name", "address", "phone", "location"].includes(field));

  const schedulingChanged =
    options.affectsAvailability === true ||
    options.changedFields?.some((field) =>
      ["timezone", "scheduleMode", "status"].includes(field),
    ) ||
    options.lifecycleChanged === true ||
    options.affectsAssignments === true;

  if (options.affectsPublicCatalog !== false && !contactOnly) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicBranches });
    void queryClient.invalidateQueries({ queryKey: ["public", "branches"] });
  } else if (contactOnly) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicBranches });
    void queryClient.invalidateQueries({ queryKey: ["public", "branches"] });
  }

  if (schedulingChanged) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "schedules", userId] });
  }

  if (options.affectsAssignments !== false && (options.affectsAssignments || schedulingChanged)) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "staff", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "resources", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "services", userId] });
  }

  if (options.lifecycleChanged) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "waiting-list", userId] });
  }

  void invalidateAdminDashboard(queryClient, userId);
}
