import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminNotificationTemplateList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "notifications", userId, "templates"] });
}

export function invalidateAdminNotificationTemplateDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.notificationTemplateDetail(userId, reference),
  });
}

export function invalidateAdminNotificationLogList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "notifications", userId, "logs"] });
}

export function invalidateAdminNotificationLogDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.notificationLogDetail(userId, reference),
  });
}

export function invalidateAfterAdminNotificationTemplateMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  void invalidateAdminNotificationTemplateList(queryClient, userId);
  if (reference) {
    void invalidateAdminNotificationTemplateDetail(queryClient, userId, reference);
    void queryClient.invalidateQueries({
      queryKey: ["admin", "notifications", userId, "variables", reference],
    });
    void queryClient.invalidateQueries({
      queryKey: ["admin", "notifications", userId, "preview", reference],
    });
  }
}

export function invalidateAfterAdminNotificationLogMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  void invalidateAdminNotificationLogList(queryClient, userId);
  if (reference) {
    void invalidateAdminNotificationLogDetail(queryClient, userId, reference);
  }
}
