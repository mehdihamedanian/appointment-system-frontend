/**
 * Phase 40 — Admin Users, Roles, Permission Matrix.
 * Admin User ≠ Staff ≠ Customer. Linking Staff never implies Admin access.
 */

export const ADMIN_ACCESS_MANAGEMENT_ENABLED = true;
export const ADMIN_USER_LIST_LIMIT = 20;
export const ADMIN_ROLE_LIST_LIMIT = 50;

/** Domains used to group Backend Permission Catalog entries in the Matrix. */
export const ADMIN_PERMISSION_DOMAINS = [
  "dashboard",
  "appointments",
  "calendar",
  "customers",
  "services",
  "staff",
  "resources",
  "schedules",
  "branches",
  "payments",
  "coupons",
  "waiting_list",
  "notifications",
  "reports",
  "users",
  "roles",
  "settings",
  "activity_logs",
  "other",
] as const;

export type AdminPermissionDomain = (typeof ADMIN_PERMISSION_DOMAINS)[number];

export const ADMIN_PERMISSION_DOMAIN_LABELS: Record<AdminPermissionDomain, string> = {
  dashboard: "داشبورد",
  appointments: "نوبت‌ها",
  calendar: "تقویم",
  customers: "مشتریان",
  services: "خدمات",
  staff: "پرسنل",
  resources: "منابع",
  schedules: "زمان‌بندی",
  branches: "شعب",
  payments: "پرداخت‌ها",
  coupons: "تخفیف‌ها",
  waiting_list: "لیست انتظار",
  notifications: "اعلان‌ها",
  reports: "گزارش‌ها",
  users: "کاربران",
  roles: "نقش‌ها",
  settings: "تنظیمات",
  activity_logs: "گزارش فعالیت",
  other: "سایر",
};

export type AdminUserStatus = "active" | "inactive" | "unknown";
export type AdminInvitationStatus =
  | "none"
  | "pending"
  | "accepted"
  | "expired"
  | "revoked"
  | "unknown";

export type AdminUserLastLoginState =
  | "never"
  | "pending_invitation"
  | "timestamp"
  | "disabled"
  | "unknown";

export type AdminUserStatusFilter = "all" | "active" | "inactive";
export type AdminInvitationStatusFilter =
  | "all"
  | "none"
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";
export type AdminUserLinkedStaffFilter = "all" | "linked" | "unlinked";

export type AdminUserSortField =
  | "displayName"
  | "createdAt"
  | "lastLoginAt"
  | "status"
  | "role";
export type AdminRoleSortField = "name" | "userCount" | "updatedAt" | "system";
export type AdminAccessSortDirection = "asc" | "desc";

export type AdminAccessRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type AdminPermissionCatalogItem = {
  key: string;
  label: string;
  description?: string;
  domain: AdminPermissionDomain;
  domainLabel: string;
  dependsOn?: string[];
  required?: boolean;
  locked?: boolean;
  riskLevel?: AdminAccessRiskLevel;
};

export type AdminPermissionCatalogView = {
  items: AdminPermissionCatalogItem[];
  version?: string;
  empty: boolean;
};

export type AdminUserAllowedActions = {
  view?: boolean;
  edit?: boolean;
  invite?: boolean;
  activate?: boolean;
  deactivate?: boolean;
  assignRole?: boolean;
  linkStaff?: boolean;
  unlinkStaff?: boolean;
  viewPermissions?: boolean;
  blockedReason?: string;
};

export type AdminRoleAllowedActions = {
  view?: boolean;
  edit?: boolean;
  delete?: boolean;
  assignPermissions?: boolean;
  blockedReason?: string;
};

export type AdminBranchScopeOption = {
  id: string;
  label: string;
};

export type AdminUserListItemView = {
  reference: string;
  displayName: string;
  maskedEmail?: string;
  maskedPhone?: string;
  roleLabel?: string;
  roleReference?: string;
  staffLabel?: string;
  staffReference?: string;
  staffHref?: string;
  status: AdminUserStatus;
  statusLabel: string;
  invitationStatus: AdminInvitationStatus;
  invitationStatusLabel: string;
  lastLoginState: AdminUserLastLoginState;
  lastLoginLabel: string;
  createdAtLabel?: string;
  detailHref: string;
  editHref: string;
  canView: boolean;
  canEdit: boolean;
};

export type AdminUserListFilters = {
  q?: string;
  roleReference?: string;
  status: AdminUserStatusFilter;
  invitationStatus: AdminInvitationStatusFilter;
  linkedStaff: AdminUserLinkedStaffFilter;
  branchId?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  sort: AdminUserSortField;
  direction: AdminAccessSortDirection;
  page: number;
};

export type AdminUserFilterOptions = {
  roles?: Array<{ id: string; label: string }>;
  branches?: AdminBranchScopeOption[];
};

export type AdminUserListView = {
  items: AdminUserListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminUserFilterOptions;
};

export type AdminUserDetailView = {
  reference: string;
  displayName: string;
  maskedEmail?: string;
  maskedPhone?: string;
  roleReference?: string;
  roleLabel?: string;
  permissionCodes: string[];
  branchScopeIds: string[];
  branchScopeLabels: string[];
  staffReference?: string;
  staffLabel?: string;
  staffHref?: string;
  status: AdminUserStatus;
  statusLabel: string;
  invitationStatus: AdminInvitationStatus;
  invitationStatusLabel: string;
  lastLoginState: AdminUserLastLoginState;
  lastLoginLabel: string;
  createdAtLabel?: string;
  isCurrentUser: boolean;
  systemOwner?: boolean;
  version?: string;
  allowedActions: AdminUserAllowedActions;
  branchScopeSupported: boolean;
};

export type AdminUserInviteInput = {
  channel: "email" | "phone";
  email?: string;
  phone?: string;
  displayName?: string;
  roleReference: string;
  branchScopeIds?: string[];
  staffReference?: string;
};

export type AdminUserUpdateInput = {
  displayName?: string;
  roleReference?: string;
  branchScopeIds?: string[];
  staffReference?: string | null;
  version?: string;
};

export type AdminAccessImpactPreview = {
  title?: string;
  summaryLines: string[];
  grantedPermissions: string[];
  revokedPermissions: string[];
  branchScopeAdded: string[];
  branchScopeRemoved: string[];
  affectedUserCount?: number;
  sessionImpact?: string;
  warnings: string[];
  blocked: boolean;
  blockedReason?: string;
  previewVersion?: string;
};

export type AdminRoleListItemView = {
  reference: string;
  name: string;
  description?: string;
  system: boolean;
  editable: boolean;
  deletable: boolean;
  userCount?: number;
  userCountLabel?: string;
  statusLabel?: string;
  detailHref: string;
  editHref: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type AdminRoleListFilters = {
  q?: string;
  system: "all" | "system" | "custom";
  sort: AdminRoleSortField;
  direction: AdminAccessSortDirection;
  page: number;
};

export type AdminRoleListView = {
  items: AdminRoleListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
};

export type AdminRoleDetailView = {
  reference: string;
  name: string;
  description?: string;
  system: boolean;
  editable: boolean;
  deletable: boolean;
  permissionKeys: string[];
  userCount?: number;
  userCountLabel?: string;
  version?: string;
  allowedActions: AdminRoleAllowedActions;
};

export type AdminRoleSaveInput = {
  name: string;
  description?: string;
  permissionKeys: string[];
  version?: string;
};

export type AdminPermissionDiff = {
  granted: string[];
  revoked: string[];
  unchanged: string[];
};
