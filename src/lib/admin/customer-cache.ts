import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminCustomerList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "customers", userId] });
}

export function invalidateAdminCustomerDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.customerDetail(userId, reference),
  });
}

export function invalidateAfterAdminCustomerMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
  options: {
    affectsContact?: boolean;
    affectsPublicProfile?: boolean;
    affectsNotesOrTags?: boolean;
    affectsLifecycle?: boolean;
    affectsManualBookingSearch?: boolean;
  } = {},
) {
  void invalidateAdminCustomerList(queryClient, userId);
  if (reference) {
    void invalidateAdminCustomerDetail(queryClient, userId, reference);
    void queryClient.invalidateQueries({
      queryKey: ["admin", "customers", userId, "appointments", reference],
    });
    void queryClient.invalidateQueries({
      queryKey: ["admin", "customers", userId, "payments", reference],
    });
  }

  if (options.affectsManualBookingSearch !== false) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "manual-booking", userId, "customer-search"] });
  }

  if (options.affectsLifecycle) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "waiting-list", userId] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  }

  if (options.affectsPublicProfile) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.customer.profile(userId) });
  }

  // Notes/tags must NOT invalidate customer-facing caches
  if (options.affectsNotesOrTags) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "customers", userId, "notes"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "customers", userId, "tags"] });
  }
}

export function invalidateAfterAdminCustomerNoteMutation(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  invalidateAfterAdminCustomerMutation(queryClient, userId, reference, {
    affectsNotesOrTags: true,
    affectsPublicProfile: false,
    affectsManualBookingSearch: false,
  });
}

export function invalidateAfterAdminCustomerTagMutation(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  invalidateAfterAdminCustomerMutation(queryClient, userId, reference, {
    affectsNotesOrTags: true,
    affectsPublicProfile: false,
    affectsManualBookingSearch: false,
  });
}
