import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import {
  inferPermissionDomain,
  diffPermissionSets,
} from "@/lib/admin/permission-catalog-audit";
import {
  ADMIN_PERMISSION_DOMAIN_LABELS,
  type AdminAccessImpactPreview,
  type AdminAccessRiskLevel,
  type AdminInvitationStatus,
  type AdminPermissionCatalogItem,
  type AdminPermissionCatalogView,
  type AdminPermissionDomain,
  type AdminRoleAllowedActions,
  type AdminRoleDetailView,
  type AdminRoleListFilters,
  type AdminRoleListItemView,
  type AdminRoleListView,
  type AdminUserAllowedActions,
  type AdminUserDetailView,
  type AdminUserLastLoginState,
  type AdminUserListFilters,
  type AdminUserListItemView,
  type AdminUserListView,
  type AdminUserStatus,
} from "@/types/admin-access";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || /^\d+$/.test(raw)) return undefined;
  if (!isSafePublicId(raw) && !/^[A-Za-z0-9_.-]{1,80}$/.test(raw)) return undefined;
  return raw;
}

function parseStatus(value: unknown): AdminUserStatus {
  const raw = readString(value)?.toLowerCase();
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled" || raw === "deactivated") return "inactive";
  return "unknown";
}

function statusLabel(status: AdminUserStatus): string {
  if (status === "active") return "فعال";
  if (status === "inactive") return "غیرفعال";
  return "نامشخص";
}

function parseInvitationStatus(value: unknown): AdminInvitationStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (
    raw === "none" ||
    raw === "pending" ||
    raw === "accepted" ||
    raw === "expired" ||
    raw === "revoked"
  ) {
    return raw;
  }
  if (!raw) return "none";
  return "unknown";
}

function invitationStatusLabel(status: AdminInvitationStatus): string {
  switch (status) {
    case "none":
      return "—";
    case "pending":
      return "دعوت در انتظار";
    case "accepted":
      return "پذیرفته‌شده";
    case "expired":
      return "منقضی";
    case "revoked":
      return "لغوشده";
    default:
      return "نامشخص";
  }
}

function parseLastLoginState(value: unknown, hasTimestamp: boolean): AdminUserLastLoginState {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "never" || raw === "never_logged_in") return "never";
  if (raw === "pending_invitation" || raw === "invitation_pending") return "pending_invitation";
  if (raw === "disabled" || raw === "inactive") return "disabled";
  if (raw === "timestamp" || hasTimestamp) return "timestamp";
  if (hasTimestamp) return "timestamp";
  return "unknown";
}

function lastLoginLabel(
  state: AdminUserLastLoginState,
  timestampLabel?: string,
): string {
  if (state === "never") return "هرگز وارد نشده";
  if (state === "pending_invitation") return "دعوت در انتظار";
  if (state === "disabled") return "غیرفعال";
  if (state === "timestamp" && timestampLabel) return timestampLabel;
  return "—";
}

function parseRisk(value: unknown): AdminAccessRiskLevel | undefined {
  const raw = readString(value)?.toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") return raw;
  if (raw) return "unknown";
  return undefined;
}

function parseDomain(value: unknown, key: string): AdminPermissionDomain {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && raw in ADMIN_PERMISSION_DOMAIN_LABELS) {
    return raw as AdminPermissionDomain;
  }
  return inferPermissionDomain(key);
}

function adaptUserAllowedActions(value: unknown): AdminUserAllowedActions {
  if (!isRecord(value)) return { view: true };
  return {
    view: readBoolean(value.view) !== false,
    edit: readBoolean(value.edit) === true,
    invite: readBoolean(value.invite) === true,
    activate: readBoolean(value.activate) === true,
    deactivate: readBoolean(value.deactivate) === true,
    assignRole: readBoolean(value.assignRole ?? value.assign_role) === true,
    linkStaff: readBoolean(value.linkStaff ?? value.link_staff) === true,
    unlinkStaff: readBoolean(value.unlinkStaff ?? value.unlink_staff) === true,
    viewPermissions: readBoolean(value.viewPermissions ?? value.view_permissions) === true,
    blockedReason: asSafeText(value.blockedReason),
  };
}

function adaptRoleAllowedActions(value: unknown): AdminRoleAllowedActions {
  if (!isRecord(value)) return { view: true };
  return {
    view: readBoolean(value.view) !== false,
    edit: readBoolean(value.edit) === true,
    delete: readBoolean(value.delete) === true,
    assignPermissions:
      readBoolean(value.assignPermissions ?? value.assign_permissions) === true,
    blockedReason: asSafeText(value.blockedReason),
  };
}

export function adaptAdminPermissionCatalogItem(
  value: unknown,
): AdminPermissionCatalogItem | null {
  if (!isRecord(value)) return null;
  const key = readString(value.key) ?? readString(value.code) ?? readString(value.id);
  if (!key || key.includes(" ")) return null;
  const label = asSafeText(value.label ?? value.name) ?? key;
  const domain = parseDomain(value.domain ?? value.group, key);
  const item: AdminPermissionCatalogItem = {
    key,
    label,
    domain,
    domainLabel: asSafeText(value.domainLabel) ?? ADMIN_PERMISSION_DOMAIN_LABELS[domain],
  };
  const description = asSafeText(value.description ?? value.helpText);
  if (description) item.description = description;
  const dependsOn = asList(value, ["dependsOn", "dependencies", "requires"])
    .map((dep) => (isRecord(dep) ? readString(dep.key) ?? readString(dep.code) : readString(dep)))
    .filter((dep): dep is string => Boolean(dep));
  if (dependsOn.length) item.dependsOn = dependsOn;
  if (readBoolean(value.required) === true) item.required = true;
  if (readBoolean(value.locked) === true) item.locked = true;
  const risk = parseRisk(value.riskLevel ?? value.risk);
  if (risk) item.riskLevel = risk;
  return item;
}

export function adaptAdminPermissionCatalog(payload: unknown): AdminPermissionCatalogView {
  const root = unwrapPayload(payload);
  const items = asList(root, ["items", "permissions", "catalog"])
    .map((item) => adaptAdminPermissionCatalogItem(item))
    .filter((item): item is AdminPermissionCatalogItem => Boolean(item));
  const view: AdminPermissionCatalogView = {
    items,
    empty: items.length === 0,
  };
  if (isRecord(root)) {
    const version = readString(root.version);
    if (version) view.version = version;
  }
  return view;
}

export function adaptAdminUserListItem(value: unknown): AdminUserListItemView | null {
  if (!isRecord(value)) return null;
  const reference =
    publicId(value.reference) ?? publicId(value.userReference) ?? publicId(value.id);
  const displayName = asSafeText(value.displayName ?? value.name ?? value.fullName);
  if (!reference || !displayName) return null;

  const status = parseStatus(value.status ?? value.state);
  const invitationStatus = parseInvitationStatus(
    value.invitationStatus ?? value.inviteStatus,
  );
  const lastLoginLabelRaw = asSafeText(
    value.lastLoginLabel ?? value.lastLoginAtLabel ?? value.lastSeenLabel,
  );
  const lastLoginState = parseLastLoginState(
    value.lastLoginState,
    Boolean(lastLoginLabelRaw || value.lastLoginAt),
  );
  const allowed = adaptUserAllowedActions(value.allowedActions);

  const item: AdminUserListItemView = {
    reference,
    displayName,
    status,
    statusLabel: asSafeText(value.statusLabel) ?? statusLabel(status),
    invitationStatus,
    invitationStatusLabel:
      asSafeText(value.invitationStatusLabel) ?? invitationStatusLabel(invitationStatus),
    lastLoginState,
    lastLoginLabel: lastLoginLabel(lastLoginState, lastLoginLabelRaw),
    detailHref: routes.admin.userDetail(reference),
    editHref: routes.admin.userEdit(reference),
    canView: allowed.view !== false,
    canEdit: allowed.edit === true,
  };

  const maskedEmail = asSafeText(value.maskedEmail ?? value.emailMasked ?? value.email);
  if (maskedEmail) item.maskedEmail = maskedEmail;
  const maskedPhone = asSafeText(value.maskedPhone ?? value.phoneMasked ?? value.phone);
  if (maskedPhone) item.maskedPhone = maskedPhone;
  const roleLabel = asSafeText(value.roleLabel ?? value.roleName);
  if (roleLabel) item.roleLabel = roleLabel;
  const roleReference = publicId(value.roleReference ?? value.roleId);
  if (roleReference) item.roleReference = roleReference;
  const staffLabel = asSafeText(value.staffLabel ?? value.staffName);
  if (staffLabel) item.staffLabel = staffLabel;
  const staffReference = publicId(value.staffReference ?? value.staffId);
  if (staffReference) {
    item.staffReference = staffReference;
    item.staffHref = routes.admin.staffDetail(staffReference);
  }
  const createdAtLabel = asSafeText(value.createdAtLabel ?? value.createdAt);
  if (createdAtLabel) item.createdAtLabel = createdAtLabel;
  return item;
}

export function adaptAdminUserList(
  payload: unknown,
  filters: AdminUserListFilters,
): AdminUserListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "users", "results"])
    .map((item) => adaptAdminUserListItem(item))
    .filter((item): item is AdminUserListItemView => Boolean(item));

  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const filtersOn =
    Boolean(filters.q) ||
    Boolean(filters.roleReference) ||
    filters.status !== "all" ||
    filters.invitationStatus !== "all" ||
    filters.linkedStaff !== "all" ||
    Boolean(filters.branchId) ||
    Boolean(filters.lastLoginFrom) ||
    Boolean(filters.lastLoginTo);
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && items.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: AdminUserListView = {
    items,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore:
      readBoolean(source.hasMore) === true ||
      (typeof pageCount === "number" && typeof page === "number" && pageCount > page),
    emptyHistory,
    filtersApplied: filtersOn,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;

  if (isRecord(source.filterOptions ?? source.filters)) {
    const optionsRoot = isRecord(source.filterOptions) ? source.filterOptions : source.filters;
    const roles = asList(optionsRoot, ["roles"]).map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id ?? item.reference);
      const label = asSafeText(item.label ?? item.name);
      return id && label ? { id, label } : null;
    }).filter(Boolean) as Array<{ id: string; label: string }>;
    const branches = asList(optionsRoot, ["branches"]).map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id ?? item.reference);
      const label = asSafeText(item.label ?? item.name);
      return id && label ? { id, label } : null;
    }).filter(Boolean) as Array<{ id: string; label: string }>;
    view.filterOptions = {};
    if (roles.length) view.filterOptions.roles = roles;
    if (branches.length) view.filterOptions.branches = branches;
  }
  return view;
}

export function adaptAdminUserDetail(
  payload: unknown,
  currentUserId?: string,
): AdminUserDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    publicId(root.reference) ?? publicId(root.userReference) ?? publicId(root.id);
  const displayName = asSafeText(root.displayName ?? root.name ?? root.fullName);
  if (!reference || !displayName) return null;

  const status = parseStatus(root.status ?? root.state);
  const invitationStatus = parseInvitationStatus(root.invitationStatus ?? root.inviteStatus);
  const lastLoginLabelRaw = asSafeText(root.lastLoginLabel ?? root.lastLoginAtLabel);
  const lastLoginState = parseLastLoginState(
    root.lastLoginState,
    Boolean(lastLoginLabelRaw || root.lastLoginAt),
  );

  const permissionCodes = asList(root, ["permissionCodes", "permissions", "permissionKeys"])
    .map((item) => (isRecord(item) ? readString(item.key) ?? readString(item.code) : readString(item)))
    .filter((item): item is string => Boolean(item));

  const branchScopeIds = asList(root, ["branchScopeIds", "branchIds", "branches"])
    .map((item) => (isRecord(item) ? publicId(item.id ?? item.reference) : publicId(item)))
    .filter((item): item is string => Boolean(item));
  const branchScopeLabels = asList(root, ["branchScopeLabels", "branches"])
    .map((item) => (isRecord(item) ? asSafeText(item.label ?? item.name) : asSafeText(item)))
    .filter((item): item is string => Boolean(item));

  const detail: AdminUserDetailView = {
    reference,
    displayName,
    permissionCodes,
    branchScopeIds,
    branchScopeLabels,
    status,
    statusLabel: asSafeText(root.statusLabel) ?? statusLabel(status),
    invitationStatus,
    invitationStatusLabel:
      asSafeText(root.invitationStatusLabel) ?? invitationStatusLabel(invitationStatus),
    lastLoginState,
    lastLoginLabel: lastLoginLabel(lastLoginState, lastLoginLabelRaw),
    isCurrentUser:
      readBoolean(root.isCurrentUser) === true ||
      (Boolean(currentUserId) && currentUserId === reference) ||
      (Boolean(currentUserId) && currentUserId === readString(root.id)),
    allowedActions: adaptUserAllowedActions(root.allowedActions),
    branchScopeSupported: readBoolean(root.branchScopeSupported) === true || branchScopeIds.length > 0,
  };

  const maskedEmail = asSafeText(root.maskedEmail ?? root.emailMasked);
  if (maskedEmail) detail.maskedEmail = maskedEmail;
  const maskedPhone = asSafeText(root.maskedPhone ?? root.phoneMasked);
  if (maskedPhone) detail.maskedPhone = maskedPhone;
  const roleReference = publicId(root.roleReference ?? root.roleId);
  if (roleReference) detail.roleReference = roleReference;
  const roleLabel = asSafeText(root.roleLabel ?? root.roleName);
  if (roleLabel) detail.roleLabel = roleLabel;
  const staffReference = publicId(root.staffReference ?? root.staffId);
  if (staffReference) {
    detail.staffReference = staffReference;
    detail.staffHref = routes.admin.staffDetail(staffReference);
  }
  const staffLabel = asSafeText(root.staffLabel ?? root.staffName);
  if (staffLabel) detail.staffLabel = staffLabel;
  const createdAtLabel = asSafeText(root.createdAtLabel ?? root.createdAt);
  if (createdAtLabel) detail.createdAtLabel = createdAtLabel;
  if (readBoolean(root.systemOwner ?? root.isOwner) === true) detail.systemOwner = true;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;
  return detail;
}

export function adaptAdminRoleListItem(value: unknown): AdminRoleListItemView | null {
  if (!isRecord(value)) return null;
  const reference =
    publicId(value.reference) ?? publicId(value.roleReference) ?? publicId(value.id);
  const name = asSafeText(value.name ?? value.label);
  if (!reference || !name) return null;
  const system = readBoolean(value.system) === true;
  const allowed = adaptRoleAllowedActions(value.allowedActions);
  const editable =
    readBoolean(value.editable) === true || (!system && allowed.edit === true);
  const deletable =
    readBoolean(value.deletable) === true || (!system && allowed.delete === true);

  const item: AdminRoleListItemView = {
    reference,
    name,
    system,
    editable,
    deletable,
    detailHref: routes.admin.roleDetail(reference),
    editHref: routes.admin.roleEdit(reference),
    canView: allowed.view !== false,
    canEdit: editable && allowed.edit !== false,
    canDelete: deletable && allowed.delete === true,
  };
  const description = asSafeText(value.description);
  if (description) item.description = description;
  const userCount = readNumber(value.userCount);
  if (typeof userCount === "number") item.userCount = userCount;
  const userCountLabel = asSafeText(value.userCountLabel);
  if (userCountLabel) item.userCountLabel = userCountLabel;
  else if (typeof userCount === "number") {
    item.userCountLabel = new Intl.NumberFormat("fa-IR").format(userCount);
  }
  const statusLabelText = asSafeText(value.statusLabel);
  if (statusLabelText) item.statusLabel = statusLabelText;
  return item;
}

export function adaptAdminRoleList(
  payload: unknown,
  filters: AdminRoleListFilters,
): AdminRoleListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "roles", "results"])
    .map((item) => adaptAdminRoleListItem(item))
    .filter((item): item is AdminRoleListItemView => Boolean(item));
  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const filtersOn = Boolean(filters.q) || filters.system !== "all";
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && items.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: AdminRoleListView = {
    items,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore:
      readBoolean(source.hasMore) === true ||
      (typeof pageCount === "number" && typeof page === "number" && pageCount > page),
    emptyHistory,
    filtersApplied: filtersOn,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;
  return view;
}

export function adaptAdminRoleDetail(payload: unknown): AdminRoleDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    publicId(root.reference) ?? publicId(root.roleReference) ?? publicId(root.id);
  const name = asSafeText(root.name ?? root.label);
  if (!reference || !name) return null;
  const system = readBoolean(root.system) === true;
  const allowed = adaptRoleAllowedActions(root.allowedActions);
  const permissionKeys = asList(root, ["permissionKeys", "permissions", "permissionCodes"])
    .map((item) => (isRecord(item) ? readString(item.key) ?? readString(item.code) : readString(item)))
    .filter((item): item is string => Boolean(item));

  const detail: AdminRoleDetailView = {
    reference,
    name,
    system,
    editable: readBoolean(root.editable) === true || (!system && allowed.edit === true),
    deletable: readBoolean(root.deletable) === true || (!system && allowed.delete === true),
    permissionKeys,
    allowedActions: allowed,
  };
  const description = asSafeText(root.description);
  if (description) detail.description = description;
  const userCount = readNumber(root.userCount);
  if (typeof userCount === "number") detail.userCount = userCount;
  const userCountLabel = asSafeText(root.userCountLabel);
  if (userCountLabel) detail.userCountLabel = userCountLabel;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;
  return detail;
}

export function adaptAdminAccessImpactPreview(
  payload: unknown,
): AdminAccessImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const summaryLines = asList(root, ["summaryLines", "summary", "lines"])
    .map((item) => asSafeText(item))
    .filter((item): item is string => Boolean(item));
  const grantedPermissions = asList(root, ["grantedPermissions", "granted"])
    .map((item) => (isRecord(item) ? readString(item.key) ?? asSafeText(item.label) : readString(item) ?? asSafeText(item)))
    .filter((item): item is string => Boolean(item));
  const revokedPermissions = asList(root, ["revokedPermissions", "revoked"])
    .map((item) => (isRecord(item) ? readString(item.key) ?? asSafeText(item.label) : readString(item) ?? asSafeText(item)))
    .filter((item): item is string => Boolean(item));
  const branchScopeAdded = asList(root, ["branchScopeAdded", "branchesAdded"])
    .map((item) => asSafeText(isRecord(item) ? item.label ?? item.name : item))
    .filter((item): item is string => Boolean(item));
  const branchScopeRemoved = asList(root, ["branchScopeRemoved", "branchesRemoved"])
    .map((item) => asSafeText(isRecord(item) ? item.label ?? item.name : item))
    .filter((item): item is string => Boolean(item));
  const warnings = asList(root, ["warnings"])
    .map((item) => asSafeText(item))
    .filter((item): item is string => Boolean(item));

  const preview: AdminAccessImpactPreview = {
    summaryLines,
    grantedPermissions,
    revokedPermissions,
    branchScopeAdded,
    branchScopeRemoved,
    warnings,
    blocked: readBoolean(root.blocked) === true,
  };
  const title = asSafeText(root.title);
  if (title) preview.title = title;
  const affectedUserCount = readNumber(root.affectedUserCount);
  if (typeof affectedUserCount === "number") preview.affectedUserCount = affectedUserCount;
  const sessionImpact = asSafeText(root.sessionImpact ?? root.sessionImpactLabel);
  if (sessionImpact) preview.sessionImpact = sessionImpact;
  const blockedReason = asSafeText(root.blockedReason);
  if (blockedReason) preview.blockedReason = blockedReason;
  const previewVersion = readString(root.previewVersion ?? root.version);
  if (previewVersion) preview.previewVersion = previewVersion;
  return preview;
}

export function buildLocalPermissionDiff(
  previous: readonly string[],
  next: readonly string[],
): AdminAccessImpactPreview {
  const diff = diffPermissionSets(previous, next);
  const summaryLines: string[] = [];
  if (diff.granted.length) {
    summaryLines.push(
      `${new Intl.NumberFormat("fa-IR").format(diff.granted.length)} مجوز اضافه می‌شود`,
    );
  }
  if (diff.revoked.length) {
    summaryLines.push(
      `${new Intl.NumberFormat("fa-IR").format(diff.revoked.length)} مجوز حذف می‌شود`,
    );
  }
  if (summaryLines.length === 0) {
    summaryLines.push("تغییری در مجوزها نیست.");
  }
  return {
    summaryLines,
    grantedPermissions: diff.granted,
    revokedPermissions: diff.revoked,
    branchScopeAdded: [],
    branchScopeRemoved: [],
    warnings: [],
    blocked: false,
  };
}

export function isAdminAccessConflict(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("STALE");
}

export function adminAccessConflictMessage(): string {
  return "این رکورد توسط فرد دیگری به‌روزرسانی شده است. لطفاً آخرین نسخه را بارگذاری کنید.";
}

export function isDuplicateAccessError(error: { status?: number; code?: string }): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return (
    code.includes("DUPLICATE") ||
    code.includes("EXISTS") ||
    code.includes("ALREADY") ||
    (error.status === 409 && code.includes("USER"))
  );
}

export function sanitizeAccessSearch(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  return raw.slice(0, 120);
}
