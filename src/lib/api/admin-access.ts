import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  adaptAdminAccessImpactPreview,
  adaptAdminPermissionCatalog,
  adaptAdminRoleDetail,
  adaptAdminRoleList,
  adaptAdminUserDetail,
  adaptAdminUserList,
} from "@/lib/admin/access-adapter";
import {
  filtersToAdminRoleParams,
  filtersToAdminUserParams,
} from "@/lib/admin/access-filters";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminAccessImpactPreview,
  AdminPermissionCatalogView,
  AdminRoleDetailView,
  AdminRoleListFilters,
  AdminRoleListView,
  AdminRoleSaveInput,
  AdminUserDetailView,
  AdminUserInviteInput,
  AdminUserListFilters,
  AdminUserListView,
  AdminUserUpdateInput,
} from "@/types/admin-access";
import {
  ADMIN_ROLE_LIST_LIMIT,
  ADMIN_USER_LIST_LIMIT,
} from "@/types/admin-access";

function buildUserListQuery(filters: AdminUserListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_USER_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminUserParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

function buildRoleListQuery(filters: AdminRoleListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(ADMIN_ROLE_LIST_LIMIT));
  for (const [key, value] of Object.entries(filtersToAdminRoleParams(filters))) {
    params.set(key, value);
  }
  return params.toString();
}

export async function fetchAdminUserList(
  filters: AdminUserListFilters,
  signal?: AbortSignal,
): Promise<AdminUserListView> {
  const payload = await apiClient<unknown>(
    `/admin/users?${buildUserListQuery(filters)}`,
    { method: "GET", signal },
  );
  return adaptAdminUserList(payload, filters);
}

export function adminUserListQueryOptions(userId: string, filters: AdminUserListFilters) {
  return {
    queryKey: queryKeys.admin.userList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminUserList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function fetchAdminUserDetail(
  reference: string,
  currentUserId?: string,
  signal?: AbortSignal,
): Promise<AdminUserDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/users/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminUserDetail(payload, currentUserId);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "کاربر مدیریت پیدا نشد.",
    });
  }
  return view;
}

export function adminUserDetailQueryOptions(
  userId: string,
  reference: string,
) {
  return {
    queryKey: queryKeys.admin.userDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminUserDetail(reference, userId, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function inviteAdminUser(
  input: AdminUserInviteInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminUserDetailView> {
  const body: Record<string, unknown> = {
    channel: input.channel,
    roleReference: input.roleReference,
  };
  if (input.email) body.email = input.email;
  if (input.phone) body.phone = input.phone;
  if (input.displayName) body.displayName = input.displayName;
  if (input.branchScopeIds?.length) body.branchScopeIds = input.branchScopeIds;
  if (input.staffReference) body.staffReference = input.staffReference;

  const payload = await apiClient<unknown>("/admin/users", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body,
  });
  const view = adaptAdminUserDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_USER_INVITE_INVALID",
      message: "دعوت کاربر نامعتبر بود.",
    });
  }
  return view;
}

export async function updateAdminUser(
  reference: string,
  input: AdminUserUpdateInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminUserDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/users/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const view = adaptAdminUserDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_USER_UPDATE_INVALID",
      message: "به‌روزرسانی کاربر نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminUserImpactPreview(
  reference: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminAccessImpactPreview> {
  const payload = await apiClient<unknown>(
    `/admin/users/${encodeURIComponent(reference)}/impact-preview`,
    { method: "POST", signal, body },
  );
  const preview = adaptAdminAccessImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_USER_IMPACT_INVALID",
      message: "پیش‌نمایش اثر در دسترس نیست.",
    });
  }
  return preview;
}

export async function submitAdminUserLifecycle(
  reference: string,
  action: "activate" | "deactivate",
  idempotencyKey: string,
  input?: { version?: string; previewVersion?: string; reason?: string },
  signal?: AbortSignal,
): Promise<AdminUserDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/users/${encodeURIComponent(reference)}/${action}`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input ?? {},
    },
  );
  const view = adaptAdminUserDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_USER_LIFECYCLE_INVALID",
      message: "تغییر وضعیت کاربر نامعتبر بود.",
    });
  }
  return view;
}

export async function fetchAdminRoleList(
  filters: AdminRoleListFilters,
  signal?: AbortSignal,
): Promise<AdminRoleListView> {
  const payload = await apiClient<unknown>(
    `/admin/roles?${buildRoleListQuery(filters)}`,
    { method: "GET", signal },
  );
  return adaptAdminRoleList(payload, filters);
}

export function adminRoleListQueryOptions(userId: string, filters: AdminRoleListFilters) {
  return {
    queryKey: queryKeys.admin.roleList(userId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminRoleList(filters, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function fetchAdminRoleDetail(
  reference: string,
  signal?: AbortSignal,
): Promise<AdminRoleDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/roles/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptAdminRoleDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "ADMIN_ROLE_NOT_FOUND",
      message: "نقش پیدا نشد.",
    });
  }
  return view;
}

export function adminRoleDetailQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.admin.roleDetail(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminRoleDetail(reference, signal),
    enabled: Boolean(userId) && Boolean(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function createAdminRole(
  input: AdminRoleSaveInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminRoleDetailView> {
  const payload = await apiClient<unknown>("/admin/roles", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      name: input.name,
      description: input.description,
      permissionKeys: input.permissionKeys,
    },
  });
  const view = adaptAdminRoleDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_ROLE_CREATE_INVALID",
      message: "ایجاد نقش نامعتبر بود.",
    });
  }
  return view;
}

export async function updateAdminRole(
  reference: string,
  input: AdminRoleSaveInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminRoleDetailView> {
  const payload = await apiClient<unknown>(
    `/admin/roles/${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    },
  );
  const view = adaptAdminRoleDetail(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_ROLE_UPDATE_INVALID",
      message: "به‌روزرسانی نقش نامعتبر بود.",
    });
  }
  return view;
}

export async function deleteAdminRole(
  reference: string,
  idempotencyKey: string,
  input?: { version?: string },
  signal?: AbortSignal,
): Promise<void> {
  await apiClient<unknown>(`/admin/roles/${encodeURIComponent(reference)}`, {
    method: "DELETE",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: input ?? {},
  });
}

export async function fetchAdminRoleImpactPreview(
  reference: string | "new",
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminAccessImpactPreview> {
  const path =
    reference === "new"
      ? "/admin/roles/impact-preview"
      : `/admin/roles/${encodeURIComponent(reference)}/impact-preview`;
  const payload = await apiClient<unknown>(path, { method: "POST", signal, body });
  const preview = adaptAdminAccessImpactPreview(payload);
  if (!preview) {
    throw new ApiError({
      status: 422,
      code: "ADMIN_ROLE_IMPACT_INVALID",
      message: "پیش‌نمایش اثر نقش در دسترس نیست.",
    });
  }
  return preview;
}

export async function fetchAdminPermissionCatalog(
  signal?: AbortSignal,
): Promise<AdminPermissionCatalogView> {
  const payload = await apiClient<unknown>("/admin/permissions/catalog", {
    method: "GET",
    signal,
  });
  return adaptAdminPermissionCatalog(payload);
}

export function adminPermissionCatalogQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.permissionCatalog(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminPermissionCatalog(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  };
}
