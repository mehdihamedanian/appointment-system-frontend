import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import { adminStaffCalendarHref } from "@/lib/admin/staff-filters";
import {
  ADMIN_STAFF_LIFECYCLE_LABELS,
  ADMIN_STAFF_SCHEDULE_MODE_LABELS,
  type AdminStaffAllowedActions,
  type AdminStaffAvatarView,
  type AdminStaffBranchAssignment,
  type AdminStaffDetailView,
  type AdminStaffFilterOptions,
  type AdminStaffImpactAction,
  type AdminStaffImpactPreview,
  type AdminStaffLifecycle,
  type AdminStaffListItem,
  type AdminStaffListView,
  type AdminStaffMutationResult,
  type AdminStaffPerformanceView,
  type AdminStaffPrivateContact,
  type AdminStaffScheduleMode,
  type AdminStaffScheduleSummary,
  type AdminStaffServiceAssignment,
} from "@/types/admin-staff";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) ? raw : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function adaptAdminStaffLifecycle(value: unknown): AdminStaffLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled") return "inactive";
  if (raw === "archived" || raw === "archive") return "archived";
  if (readBoolean(value) === true) return "active";
  if (readBoolean(value) === false) return "inactive";
  return "unknown";
}

function adaptScheduleMode(value: unknown): AdminStaffScheduleMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "inherit_business" || raw === "business") return "inherit_business";
  if (raw === "inherit_branch" || raw === "branch") return "inherit_branch";
  if (raw === "custom" || raw === "staff") return "custom";
  return "unknown";
}

function adaptAvatar(value: unknown, name: string): AdminStaffAvatarView | undefined {
  if (!isRecord(value)) {
    const imageUrl = asSafeText(value);
    if (imageUrl) return { imageUrl };
    return { initials: initialsFromName(name) };
  }
  const imageUrl = asSafeText(value.imageUrl) ?? asSafeText(value.url) ?? asSafeText(value.avatarUrl);
  const initials = asSafeText(value.initials) ?? initialsFromName(name);
  if (imageUrl) return { imageUrl, initials };
  return { initials };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
}

function adaptSchedule(value: unknown): AdminStaffScheduleSummary {
  if (!isRecord(value)) return { mode: "unknown" };
  const mode = adaptScheduleMode(value.mode ?? value.scheduleMode);
  const summary: AdminStaffScheduleSummary = { mode };
  const sourceLabel = asSafeText(value.sourceLabel) ?? asSafeText(value.source);
  if (sourceLabel) summary.sourceLabel = sourceLabel;
  else if (mode !== "unknown") summary.sourceLabel = ADMIN_STAFF_SCHEDULE_MODE_LABELS[mode];
  const text = asSafeText(value.summary) ?? asSafeText(value.label);
  if (text) summary.summary = text;
  const working = asSafeText(value.workingHoursLabel) ?? asSafeText(value.workingHours);
  if (working) summary.workingHoursLabel = working;
  const breaks = asSafeText(value.breaksLabel) ?? asSafeText(value.breaks);
  if (breaks) summary.breaksLabel = breaks;
  const leave = asSafeText(value.leaveLabel) ?? asSafeText(value.timeOffLabel) ?? asSafeText(value.timeOff);
  if (leave) summary.leaveLabel = leave;
  const block = asSafeText(value.blockTimeLabel) ?? asSafeText(value.blockedTime);
  if (block) summary.blockTimeLabel = block;
  return summary;
}

function adaptBranches(value: unknown): AdminStaffBranchAssignment[] {
  return asList(value, ["items", "branches"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.branchId);
      const name = asSafeText(item.name) ?? asSafeText(item.branchName);
      if (!id || !name) return null;
      const assignment: AdminStaffBranchAssignment = { id, name };
      if (readBoolean(item.primary) === true || readBoolean(item.isPrimary) === true) {
        assignment.primary = true;
      }
      return assignment;
    })
    .filter((item): item is AdminStaffBranchAssignment => Boolean(item));
}

function adaptServices(value: unknown): AdminStaffServiceAssignment[] {
  return asList(value, ["items", "services"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.serviceId);
      const name = asSafeText(item.name) ?? asSafeText(item.serviceName);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is AdminStaffServiceAssignment => Boolean(item));
}

function adaptAllowedActions(value: unknown): AdminStaffAllowedActions {
  if (!isRecord(value)) return { view: true, edit: true, viewCalendar: true };
  const source = isRecord(value.allowedActions) ? value.allowedActions : value;
  const read = (key: string, ...alts: string[]) => {
    if (readBoolean(source[key]) === true) return true;
    for (const alt of alts) {
      if (readBoolean(source[alt]) === true) return true;
    }
    return undefined;
  };
  return {
    view: read("view", "canView") ?? true,
    edit: read("edit", "canEdit", "update"),
    deactivate: read("deactivate", "canDeactivate"),
    activate: read("activate", "canActivate"),
    archive: read("archive", "canArchive"),
    delete: read("delete", "canDelete"),
    viewCalendar: read("viewCalendar", "calendar") ?? true,
    viewPerformance: read("viewPerformance", "performance"),
    manageSchedule: read("manageSchedule", "schedule"),
    viewPrivateContact: read("viewPrivateContact", "privateContact"),
    uploadAvatar: read("uploadAvatar", "avatarUpload"),
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptPrivateContact(value: unknown, canView: boolean): AdminStaffPrivateContact | undefined {
  if (!isRecord(value)) return undefined;
  const phone = asSafeText(value.phone) ?? asSafeText(value.mobile);
  const email = asSafeText(value.email);
  if (!phone && !email) return undefined;
  if (!canView) {
    return {
      phone: phone ? maskPhone(phone) : undefined,
      email: email ? maskEmail(email) : undefined,
      masked: true,
    };
  }
  return { phone, email, masked: false };
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••${digits.slice(-4)}`;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "•••@•••";
  return `${local.slice(0, 1)}•••@${domain}`;
}

function readStaffName(root: Record<string, unknown>): string | undefined {
  const full = asSafeText(root.name) ?? asSafeText(root.fullName) ?? asSafeText(root.displayName);
  if (full) return full;
  const first = asSafeText(root.firstName);
  const last = asSafeText(root.lastName);
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return undefined;
}

function adaptListItem(value: unknown): AdminStaffListItem | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id) ?? publicId(value.staffId);
  const reference = readString(value.reference) ?? readString(value.staffReference) ?? id;
  const name = readStaffName(value);
  if (!id || !reference || !name) return null;

  const lifecycle = adaptAdminStaffLifecycle(
    value.lifecycle ?? value.status ?? value.active ?? value.state,
  );
  const resourceRef = publicId(value.resourceReference) ?? publicId(value.resourceId);

  const item: AdminStaffListItem = {
    id,
    reference,
    name,
    branches: adaptBranches(value.branches ?? value.branchAssignments),
    services: adaptServices(value.services ?? value.serviceAssignments ?? value.assignedServices),
    lifecycle,
    lifecycleLabel: asSafeText(value.lifecycleLabel) ?? ADMIN_STAFF_LIFECYCLE_LABELS[lifecycle],
    customerVisible: readBoolean(value.customerVisible) === true,
    bookable: readBoolean(value.bookable) !== false && readBoolean(value.isBookable) !== false,
    allowedActions: adaptAllowedActions(value),
  };

  const jobTitle = asSafeText(value.jobTitle) ?? asSafeText(value.title);
  if (jobTitle) item.jobTitle = jobTitle;
  const specialty = asSafeText(value.specialty) ?? asSafeText(value.specialization);
  if (specialty) item.specialty = specialty;
  item.avatar = adaptAvatar(value.avatar ?? value.profileImage, name);
  if (isRecord(value.schedule) || value.scheduleSummary) {
    item.schedule = adaptSchedule(value.schedule ?? value.scheduleSummary);
  }
  if (resourceRef) {
    item.resourceHref = routes.admin.resourceDetail(resourceRef);
  }
  return item;
}

function adaptFilterOptions(value: unknown): AdminStaffFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminStaffFilterOptions = {};
  const readNamed = (key: string) =>
    asList(value[key], ["items", "options"])
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = publicId(item.id) ?? publicId(item.value);
        const name = asSafeText(item.name) ?? asSafeText(item.label);
        if (!id || !name) return null;
        return { id, name };
      })
      .filter((item): item is { id: string; name: string } => Boolean(item));
  const branches = readNamed("branches");
  if (branches.length) options.branches = branches;
  const services = readNamed("services");
  if (services.length) options.services = services;
  const readLabeled = (key: string) =>
    asList(value[key], ["items", "options"])
      .map((item) => {
        if (!isRecord(item)) return null;
        const val = readString(item.value) ?? readString(item.id) ?? asSafeText(item.name);
        const label = asSafeText(item.label) ?? asSafeText(item.name);
        if (!val || !label) return null;
        return { value: val, label };
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));
  const jobTitles = readLabeled("jobTitles");
  if (jobTitles.length) options.jobTitles = jobTitles;
  const specialties = readLabeled("specialties");
  if (specialties.length) options.specialties = specialties;
  return Object.keys(options).length ? options : undefined;
}

export function adaptAdminStaffList(payload: unknown, page: number): AdminStaffListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(source, ["items", "staff", "results"])
    .map((item) => adaptListItem(item))
    .filter((item): item is AdminStaffListItem => Boolean(item));
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof pageCount === "number" && page < pageCount);
  return {
    items,
    page,
    pageCount: pageCount ?? undefined,
    totalCount: totalCount ?? undefined,
    hasMore,
    filtersApplied: readBoolean(source.filtersApplied) === true,
    emptyCatalog:
      readBoolean(source.emptyCatalog) === true || readBoolean(source.emptyHistory) === true,
    filterOptions: adaptFilterOptions(source.filterOptions ?? source.filters),
  };
}

export function adaptAdminStaffDetail(payload: unknown): AdminStaffDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const listItem = adaptListItem(root);
  if (!listItem) return null;

  const allowedActions = listItem.allowedActions;
  const canViewPrivate = allowedActions.viewPrivateContact === true;
  const capabilitiesSource = isRecord(root.capabilities) ? root.capabilities : root;

  const resourceReference = publicId(root.resourceReference) ?? publicId(root.resourceId);
  const adminUserReference = publicId(root.adminUserReference) ?? publicId(root.userId);
  const hasPerformance = readBoolean(capabilitiesSource.hasPerformance) === true;
  const hasAvatarUpload = readBoolean(capabilitiesSource.hasAvatarUpload) === true;
  const hasCalendar = readBoolean(capabilitiesSource.hasCalendar) !== false;

  return {
    id: listItem.id,
    reference: listItem.reference,
    firstName: asSafeText(root.firstName),
    lastName: asSafeText(root.lastName),
    name: listItem.name,
    jobTitle: listItem.jobTitle,
    specialty: listItem.specialty,
    publicDescription:
      asSafeText(root.publicDescription) ??
      asSafeText(root.customerDescription) ??
      asSafeText(root.description),
    avatar: listItem.avatar,
    privateContact: adaptPrivateContact(root.privateContact ?? root.contact, canViewPrivate),
    branches: listItem.branches,
    services: listItem.services,
    lifecycle: listItem.lifecycle,
    lifecycleLabel: listItem.lifecycleLabel,
    customerVisible: listItem.customerVisible,
    bookable: listItem.bookable,
    schedule: listItem.schedule ?? adaptSchedule(root.schedule ?? root.scheduleSummary),
    resourceReference,
    resourceHref: resourceReference ? routes.admin.resourceDetail(resourceReference) : undefined,
    adminUserReference,
    adminUserHref: adminUserReference ? `${routes.admin.users}/${adminUserReference}` : undefined,
    calendarHref: hasCalendar ? adminStaffCalendarHref(listItem.id) : undefined,
    performanceHref:
      hasPerformance && allowedActions.viewPerformance !== false
        ? routes.admin.staffPerformance(listItem.reference)
        : undefined,
    allowedActions,
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    capabilities: {
      hasAvatarUpload,
      hasPrivateContact: readBoolean(capabilitiesSource.hasPrivateContact) !== false,
      hasPerformance,
      hasSchedule: readBoolean(capabilitiesSource.hasSchedule) !== false,
      hasCalendar,
      hasMultiBranch: readBoolean(capabilitiesSource.hasMultiBranch) === true,
      hasServiceAssignment: readBoolean(capabilitiesSource.hasServiceAssignment) !== false,
    },
  };
}

export function adaptAdminStaffImpactPreview(
  payload: unknown,
  action: AdminStaffImpactAction,
): AdminStaffImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const effects = asList(root.effects ?? root.impacts, ["items"])
    .map((item) =>
      typeof item === "string"
        ? asSafeText(item)
        : isRecord(item)
          ? asSafeText(item.label) ?? asSafeText(item.message)
          : undefined,
    )
    .filter((item): item is string => Boolean(item));
  const summary =
    asSafeText(root.summary) ??
    asSafeText(root.message) ??
    "این تغییر ممکن است روی نوبت‌ها و دسترسی‌ها اثر بگذارد.";
  return {
    action,
    title: asSafeText(root.title) ?? "تأیید تغییر",
    summary,
    effects,
    futureAppointmentCount: readNumber(root.futureAppointmentCount),
    serviceMappingCount: readNumber(root.serviceMappingCount),
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason),
    contextId: readString(root.contextId) ?? readString(root.branchId) ?? readString(root.serviceId),
  };
}

export function adaptAdminStaffMutationResult(
  payload: unknown,
): AdminStaffMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    readString(root.reference) ?? readString(root.staffReference) ?? publicId(root.id);
  if (!reference) return null;
  return {
    reference,
    lifecycle: adaptAdminStaffLifecycle(root.lifecycle ?? root.status ?? root.state),
    message: asSafeText(root.message),
    version: readString(root.version),
    updatedAt: readString(root.updatedAt),
  };
}

export function adaptAdminStaffPerformance(payload: unknown): AdminStaffPerformanceView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    readString(root.reference) ?? readString(root.staffReference) ?? publicId(root.id);
  if (!reference) return null;
  const metrics = asList(root.metrics ?? root.items, ["items"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      const value =
        asSafeText(item.value) ??
        asSafeText(item.amountLabel) ??
        (readNumber(item.value) !== undefined ? String(readNumber(item.value)) : undefined);
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
  return {
    reference,
    periodLabel: asSafeText(root.periodLabel) ?? asSafeText(root.period),
    appointmentCount: readNumber(root.appointmentCount),
    completedCount: readNumber(root.completedCount),
    cancelledCount: readNumber(root.cancelledCount),
    noShowCount: readNumber(root.noShowCount),
    utilizationLabel: asSafeText(root.utilizationLabel) ?? asSafeText(root.utilization),
    revenueLabel: asSafeText(root.revenueLabel) ?? asSafeText(root.revenue),
    metrics,
  };
}

export function isAdminStaffConflict(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("STALE");
}

export function adminStaffConflictMessage(): string {
  return "این کارمند توسط فرد دیگری به‌روزرسانی شده است. لطفاً آخرین نسخه را بررسی کنید.";
}

export function isDuplicateStaffError(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) {
    const code = error.code?.toUpperCase() ?? "";
    return code.includes("DUPLICATE") || code.includes("EXISTS");
  }
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("DUPLICATE") || code.includes("EXISTS");
}

/** Staff who are not customer-visible must never be treated as public providers. */
export function isInternalStaffForCustomerUI(staff: {
  customerVisible?: boolean;
  bookable?: boolean;
}): boolean {
  return staff.customerVisible !== true;
}
