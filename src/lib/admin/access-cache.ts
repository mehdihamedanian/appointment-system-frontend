import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminUserList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
}

export function invalidateAdminUserDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.userDetail(userId, reference),
  });
}

export function invalidateAdminRoleList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "roles", userId] });
}

export function invalidateAdminRoleDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.roleDetail(userId, reference),
  });
}

export function invalidateAdminPermissionCatalog(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.permissionCatalog(userId),
  });
}

export function clearAdminAccessCaches(queryClient: QueryClient, userId?: string) {
  if (userId) {
    void queryClient.removeQueries({ queryKey: ["admin", "users", userId] });
    void queryClient.removeQueries({ queryKey: ["admin", "roles", userId] });
    void queryClient.removeQueries({ queryKey: ["admin", "permissions", userId] });
    return;
  }
  void queryClient.removeQueries({ queryKey: ["admin", "users"] });
  void queryClient.removeQueries({ queryKey: ["admin", "roles"] });
  void queryClient.removeQueries({ queryKey: ["admin", "permissions"] });
}

/**
 * After mutations that may affect the current session: refresh session,
 * clear access caches, and drop unauthorized admin query data broadly.
 */
export async function refreshSessionAfterAccessChange(
  queryClient: QueryClient,
  sessionUserId: string,
  options?: { affectedCurrentUser?: boolean },
) {
  void invalidateAdminUserList(queryClient, sessionUserId);
  void invalidateAdminRoleList(queryClient, sessionUserId);
  void invalidateAdminPermissionCatalog(queryClient, sessionUserId);

  if (options?.affectedCurrentUser) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.session });
    // Drop cached admin pages so revoked permissions cannot linger.
    void queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === "admin";
      },
    });
  }
}

export function invalidateAfterAdminUserMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  void invalidateAdminUserList(queryClient, userId);
  if (reference) {
    void invalidateAdminUserDetail(queryClient, userId, reference);
  }
}

export function invalidateAfterAdminRoleMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  void invalidateAdminRoleList(queryClient, userId);
  void invalidateAdminUserList(queryClient, userId);
  if (reference) {
    void invalidateAdminRoleDetail(queryClient, userId, reference);
  }
}
