import { routes } from "@/constants/routes";
import { sanitizeIsoDate, sanitizeBranchId } from "@/lib/admin/dashboard-filters";
import { sanitizeAccessSearch } from "@/lib/admin/access-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import type {
  AdminAccessSortDirection,
  AdminInvitationStatusFilter,
  AdminRoleListFilters,
  AdminRoleSortField,
  AdminUserLinkedStaffFilter,
  AdminUserListFilters,
  AdminUserSortField,
  AdminUserStatusFilter,
} from "@/types/admin-access";

function sanitizeReference(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || /^\d+$/.test(raw)) return undefined;
  if (!isSafePublicId(raw) && !/^[A-Za-z0-9_.-]{1,80}$/.test(raw)) return undefined;
  return raw;
}

function parsePage(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseDirection(value: string | null | undefined): AdminAccessSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

export function parseAdminUserStatusFilter(
  value: string | null | undefined,
): AdminUserStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw === "active" || raw === "inactive") return raw;
  return "all";
}

export function parseAdminInvitationStatusFilter(
  value: string | null | undefined,
): AdminInvitationStatusFilter {
  const raw = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    raw === "none" ||
    raw === "pending" ||
    raw === "accepted" ||
    raw === "expired" ||
    raw === "revoked"
  ) {
    return raw;
  }
  return "all";
}

export function parseAdminUserLinkedStaffFilter(
  value: string | null | undefined,
): AdminUserLinkedStaffFilter {
  const raw = value?.trim().toLowerCase();
  if (raw === "linked" || raw === "unlinked") return raw;
  return "all";
}

export function parseAdminUserSort(value: string | null | undefined): AdminUserSortField {
  const raw = value?.trim() as AdminUserSortField | undefined;
  if (
    raw === "displayName" ||
    raw === "createdAt" ||
    raw === "lastLoginAt" ||
    raw === "status" ||
    raw === "role"
  ) {
    return raw;
  }
  return "createdAt";
}

export function parseAdminRoleSort(value: string | null | undefined): AdminRoleSortField {
  const raw = value?.trim() as AdminRoleSortField | undefined;
  if (raw === "name" || raw === "userCount" || raw === "updatedAt" || raw === "system") {
    return raw;
  }
  return "name";
}

export function defaultAdminUserFilters(): AdminUserListFilters {
  return {
    status: "all",
    invitationStatus: "all",
    linkedStaff: "all",
    sort: "createdAt",
    direction: "desc",
    page: 1,
  };
}

export function defaultAdminRoleFilters(): AdminRoleListFilters {
  return {
    system: "all",
    sort: "name",
    direction: "asc",
    page: 1,
  };
}

export function parseAdminUserFilters(search: {
  get(name: string): string | null;
}): AdminUserListFilters {
  const filters: AdminUserListFilters = {
    status: parseAdminUserStatusFilter(search.get("status")),
    invitationStatus: parseAdminInvitationStatusFilter(search.get("invitationStatus")),
    linkedStaff: parseAdminUserLinkedStaffFilter(search.get("linkedStaff")),
    sort: parseAdminUserSort(search.get("sort")),
    direction: parseDirection(search.get("direction")),
    page: parsePage(search.get("page")),
  };
  const q = sanitizeAccessSearch(search.get("q"));
  if (q) filters.q = q;
  const roleReference = sanitizeReference(search.get("role") ?? search.get("roleReference"));
  if (roleReference) filters.roleReference = roleReference;
  const branchId =
    sanitizeBranchId(search.get("branchId")) ?? sanitizeBranchId(search.get("branch"));
  if (branchId) filters.branchId = branchId;
  const lastLoginFrom = sanitizeIsoDate(search.get("lastLoginFrom"));
  if (lastLoginFrom) filters.lastLoginFrom = lastLoginFrom;
  const lastLoginTo = sanitizeIsoDate(search.get("lastLoginTo"));
  if (lastLoginTo) filters.lastLoginTo = lastLoginTo;
  return filters;
}

export function parseAdminRoleFilters(search: {
  get(name: string): string | null;
}): AdminRoleListFilters {
  const systemRaw = search.get("system")?.trim().toLowerCase();
  const filters: AdminRoleListFilters = {
    system:
      systemRaw === "system" || systemRaw === "custom" ? systemRaw : "all",
    sort: parseAdminRoleSort(search.get("sort")),
    direction: parseDirection(search.get("direction")),
    page: parsePage(search.get("page")),
  };
  const q = sanitizeAccessSearch(search.get("q"));
  if (q) filters.q = q;
  return filters;
}

export function adminUserFiltersApplied(filters: AdminUserListFilters): boolean {
  return (
    Boolean(filters.q) ||
    Boolean(filters.roleReference) ||
    filters.status !== "all" ||
    filters.invitationStatus !== "all" ||
    filters.linkedStaff !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.lastLoginFrom) ||
    Boolean(filters.lastLoginTo)
  );
}

export function countActiveAdminUserFilters(filters: AdminUserListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.roleReference) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.invitationStatus !== "all") count += 1;
  if (filters.linkedStaff !== "all") count += 1;
  if (filters.branchId) count += 1;
  if (filters.lastLoginFrom || filters.lastLoginTo) count += 1;
  return count;
}

export function adminRoleFiltersApplied(filters: AdminRoleListFilters): boolean {
  return Boolean(filters.q) || filters.system !== "all";
}

export function countActiveAdminRoleFilters(filters: AdminRoleListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.system !== "all") count += 1;
  return count;
}

export function adminUsersHref(input: Partial<AdminUserListFilters> = {}): string {
  const filters: AdminUserListFilters = { ...defaultAdminUserFilters(), ...input };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.roleReference) params.set("role", filters.roleReference);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.invitationStatus !== "all") {
    params.set("invitationStatus", filters.invitationStatus);
  }
  if (filters.linkedStaff !== "all") params.set("linkedStaff", filters.linkedStaff);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.lastLoginFrom) params.set("lastLoginFrom", filters.lastLoginFrom);
  if (filters.lastLoginTo) params.set("lastLoginTo", filters.lastLoginTo);
  if (filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.users}?${query}` : routes.admin.users;
}

export function adminRolesHref(input: Partial<AdminRoleListFilters> = {}): string {
  const filters: AdminRoleListFilters = { ...defaultAdminRoleFilters(), ...input };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.system !== "all") params.set("system", filters.system);
  if (filters.sort !== "name") params.set("sort", filters.sort);
  if (filters.direction !== "asc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.roles}?${query}` : routes.admin.roles;
}

export function filtersToAdminUserParams(
  filters: AdminUserListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    sort: filters.sort,
    direction: filters.direction,
    page: String(filters.page),
  };
  if (filters.q) params.q = filters.q;
  if (filters.roleReference) params.roleReference = filters.roleReference;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.invitationStatus !== "all") {
    params.invitationStatus = filters.invitationStatus;
  }
  if (filters.linkedStaff !== "all") params.linkedStaff = filters.linkedStaff;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.lastLoginFrom) params.lastLoginFrom = filters.lastLoginFrom;
  if (filters.lastLoginTo) params.lastLoginTo = filters.lastLoginTo;
  return params;
}

export function filtersToAdminRoleParams(
  filters: AdminRoleListFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    sort: filters.sort,
    direction: filters.direction,
    page: String(filters.page),
  };
  if (filters.q) params.q = filters.q;
  if (filters.system !== "all") params.system = filters.system;
  return params;
}

export function accessPermission(
  kind:
    | "usersView"
    | "usersCreate"
    | "usersEdit"
    | "usersDeactivate"
    | "usersAssignRole"
    | "usersLinkStaff"
    | "rolesView"
    | "rolesCreate"
    | "rolesEdit"
    | "rolesDelete"
    | "rolesAssignPermissions",
): string {
  switch (kind) {
    case "usersView":
      return "admin.users.view";
    case "usersCreate":
      return "admin.users.create";
    case "usersEdit":
      return "admin.users.edit";
    case "usersDeactivate":
      return "admin.users.deactivate";
    case "usersAssignRole":
      return "admin.users.assign_role";
    case "usersLinkStaff":
      return "admin.users.link_staff";
    case "rolesView":
      return "admin.roles.view";
    case "rolesCreate":
      return "admin.roles.create";
    case "rolesEdit":
      return "admin.roles.edit";
    case "rolesDelete":
      return "admin.roles.delete";
    case "rolesAssignPermissions":
      return "admin.roles.assign_permissions";
  }
}
