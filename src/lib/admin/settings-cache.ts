import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { AdminSettingsSection } from "@/types/admin-settings";

export function invalidateAdminSettingsSection(
  queryClient: QueryClient,
  userId: string,
  section: AdminSettingsSection,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.settingsSection(userId, section),
  });
}

/**
 * Targeted cache invalidation after a confirmed settings save.
 * Does not clear the entire query cache.
 */
export function invalidateAfterAdminSettingsMutation(
  queryClient: QueryClient,
  userId: string,
  section: AdminSettingsSection,
) {
  void invalidateAdminSettingsSection(queryClient, userId, section);

  switch (section) {
    case "general":
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
      break;
    case "localization":
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicServices });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "calendar", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "reports", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "waiting-list", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.appointments(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
      break;
    case "booking":
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "availability", userId],
      });
      break;
    case "payments":
      void queryClient.invalidateQueries({ queryKey: ["booking", "quote"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
      break;
    case "notifications":
      void queryClient.invalidateQueries({
        queryKey: ["admin", "notifications", userId],
      });
      break;
  }
}

/** After logo upload/remove — branding surfaces only. */
export function invalidateAfterLogoMutation(queryClient: QueryClient, userId: string) {
  void invalidateAdminSettingsSection(queryClient, userId, "general");
  void queryClient.invalidateQueries({ queryKey: queryKeys.publicBusiness });
}
