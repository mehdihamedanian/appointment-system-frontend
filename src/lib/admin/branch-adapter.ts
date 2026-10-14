import { asList, asSafeText, readBoolean, readUrl, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import {
  adminBranchCalendarHref,
  adminBranchDetailHref,
  adminBranchEditHref,
  adminScheduleBranchHref,
} from "@/lib/admin/branch-filters";
import {
  ADMIN_BRANCH_LIFECYCLE_LABELS,
  ADMIN_BRANCH_SCHEDULE_MODE_LABELS,
  type AdminBranchAllowedActions,
  type AdminBranchCapabilities,
  type AdminBranchDetailView,
  type AdminBranchFormErrors,
  type AdminBranchFormImpactField,
  type AdminBranchFormInput,
  type AdminBranchImpactAction,
  type AdminBranchImpactPreview,
  type AdminBranchLifecycle,
  type AdminBranchListItem,
  type AdminBranchListView,
  type AdminBranchLocationView,
  type AdminBranchMutationResult,
  type AdminBranchOperationalWarning,
  type AdminBranchResourceAssignment,
  type AdminBranchScheduleMode,
  type AdminBranchScheduleSummary,
  type AdminBranchServiceAssignment,
  type AdminBranchStaffAssignment,
} from "@/types/admin-branch";

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

export function adaptAdminBranchLifecycle(value: unknown): AdminBranchLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled") return "inactive";
  if (raw === "archived" || raw === "archive") return "archived";
  if (readBoolean(value) === true) return "active";
  if (readBoolean(value) === false) return "inactive";
  return "unknown";
}

function adaptScheduleMode(value: unknown): AdminBranchScheduleMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "inherit_business" || raw === "business") return "inherit_business";
  if (raw === "custom" || raw === "branch") return "custom";
  return "unknown";
}

function adaptSchedule(value: unknown): AdminBranchScheduleSummary {
  if (!isRecord(value)) return { mode: "unknown" };
  const mode = adaptScheduleMode(value.mode ?? value.scheduleMode);
  const summary: AdminBranchScheduleSummary = { mode };
  const sourceLabel = asSafeText(value.sourceLabel) ?? asSafeText(value.source);
  if (sourceLabel) summary.sourceLabel = sourceLabel;
  else if (mode !== "unknown") summary.sourceLabel = ADMIN_BRANCH_SCHEDULE_MODE_LABELS[mode];
  const text = asSafeText(value.summary) ?? asSafeText(value.label);
  if (text) summary.summary = text;
  const working = asSafeText(value.workingHoursLabel) ?? asSafeText(value.workingHours);
  if (working) summary.workingHoursLabel = working;
  const holidays = asSafeText(value.holidaysLabel) ?? asSafeText(value.holidays);
  if (holidays) summary.holidaysLabel = holidays;
  return summary;
}

function adaptLocation(value: unknown): AdminBranchLocationView | undefined {
  if (!isRecord(value)) return undefined;
  const location: AdminBranchLocationView = {};
  const lat = readNumber(value.latitude ?? value.lat);
  const lng = readNumber(value.longitude ?? value.lng ?? value.lon);
  if (lat != null) location.latitude = lat;
  if (lng != null) location.longitude = lng;
  const mapUrl = readUrl(value.mapUrl) ?? readUrl(value.mapLink);
  if (mapUrl) location.mapUrl = mapUrl;
  const directionsUrl = readUrl(value.directionsUrl);
  if (directionsUrl) location.directionsUrl = directionsUrl;
  const label = asSafeText(value.label) ?? asSafeText(value.name);
  if (label) location.label = label;
  return Object.keys(location).length ? location : undefined;
}

function adaptAllowedActions(value: unknown): AdminBranchAllowedActions {
  const source = isRecord(value) ? value : {};
  const read = (key: string, alt?: string) =>
    readBoolean(source[key]) === true || (alt ? readBoolean(source[alt]) === true : false);
  return {
    view: read("view"),
    edit: read("edit", "manage"),
    create: read("create"),
    deactivate: read("deactivate"),
    activate: read("activate"),
    archive: read("archive"),
    delete: read("delete"),
    manageSchedule: read("manageSchedule", "schedule"),
    manageHolidays: read("manageHolidays", "holidays"),
    assignStaff: read("assignStaff", "staff"),
    assignResources: read("assignResources", "resources"),
    assignServices: read("assignServices", "services"),
    viewCalendar: read("viewCalendar", "calendar"),
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminBranchCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsTimezoneEdit: readBoolean(source.supportsTimezoneEdit) === true,
    supportsLocationCoordinates: readBoolean(source.supportsLocationCoordinates) === true,
    supportsMapUrl: readBoolean(source.supportsMapUrl) !== false,
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsServiceFeasibilityCheck: readBoolean(source.supportsServiceFeasibilityCheck) !== false,
  };
}

function adaptStaffAssignments(value: unknown): AdminBranchStaffAssignment[] {
  return asList(value, ["items", "staff"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = publicId(item.id) ?? publicId(item.staffId);
      const reference = readString(item.reference) ?? readString(item.staffReference) ?? id;
      const name = asSafeText(item.name) ?? asSafeText(item.staffName);
      if (!id || !reference || !name) return [];
      return [
        {
          id,
          reference,
          name,
          jobTitle: asSafeText(item.jobTitle),
          primary: readBoolean(item.primary) === true || readBoolean(item.isPrimary) === true,
          scheduleCompatible: readBoolean(item.scheduleCompatible) !== false,
          warning: asSafeText(item.warning),
        } satisfies AdminBranchStaffAssignment,
      ];
    });
}

function adaptResourceAssignments(value: unknown): AdminBranchResourceAssignment[] {
  return asList(value, ["items", "resources"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = publicId(item.id) ?? publicId(item.resourceId);
      const reference = readString(item.reference) ?? readString(item.resourceReference) ?? id;
      const name = asSafeText(item.name) ?? asSafeText(item.resourceName);
      if (!id || !reference || !name) return [];
      return [
        {
          id,
          reference,
          name,
          type: readString(item.type),
          typeLabel: asSafeText(item.typeLabel),
        } satisfies AdminBranchResourceAssignment,
      ];
    });
}

function adaptServiceAssignments(value: unknown): AdminBranchServiceAssignment[] {
  return asList(value, ["items", "services"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = publicId(item.id) ?? publicId(item.serviceId);
      const reference = readString(item.reference) ?? readString(item.serviceReference) ?? id;
      const name = asSafeText(item.name) ?? asSafeText(item.serviceName);
      if (!id || !reference || !name) return [];
      const lifecycle = readString(item.lifecycle);
      return [
        {
          id,
          reference,
          name,
          lifecycle,
          lifecycleLabel: asSafeText(item.lifecycleLabel),
          feasible: readBoolean(item.feasible) !== false,
          warning: asSafeText(item.warning) ?? asSafeText(item.feasibilityWarning),
        } satisfies AdminBranchServiceAssignment,
      ];
    });
}

function adaptWarnings(value: unknown): AdminBranchOperationalWarning[] {
  return asList(value, ["items", "warnings", "operationalWarnings"])
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: `warn_${index}`, message: item };
      }
      if (!isRecord(item)) return null;
      const id = readString(item.id) ?? `warn_${index}`;
      const message = asSafeText(item.message) ?? asSafeText(item.text);
      if (!message) return null;
      const severityRaw = readString(item.severity)?.toLowerCase();
      const severity =
        severityRaw === "danger" || severityRaw === "warning" || severityRaw === "info"
          ? severityRaw
          : undefined;
      return { id, message, severity };
    })
    .filter((item): item is AdminBranchOperationalWarning => Boolean(item));
}

function adaptListItem(value: unknown): AdminBranchListItem | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id);
  const reference = readString(value.reference) ?? id;
  const name = asSafeText(value.name);
  if (!id || !reference || !name) return null;
  const lifecycle = adaptAdminBranchLifecycle(value.lifecycle ?? value.status ?? value.active);
  const lifecycleLabel =
    lifecycle !== "unknown"
      ? ADMIN_BRANCH_LIFECYCLE_LABELS[lifecycle]
      : (asSafeText(value.lifecycleLabel) ?? "نامشخص");
  return {
    id,
    reference,
    name,
    publicTitle: asSafeText(value.publicTitle) ?? asSafeText(value.title),
    address: asSafeText(value.address),
    phone: asSafeText(value.phone),
    lifecycle,
    lifecycleLabel,
    schedule: isRecord(value.schedule) || value.scheduleSummary ? adaptSchedule(value.schedule ?? value.scheduleSummary) : undefined,
    staffCount: readNumber(value.staffCount),
    resourceCount: readNumber(value.resourceCount),
    serviceCount: readNumber(value.serviceCount),
    detailHref: adminBranchDetailHref(reference),
    editHref: adminBranchEditHref(reference),
    scheduleHref: adminScheduleBranchHref(reference),
    calendarHref: adminBranchCalendarHref(reference),
  };
}

export function adaptAdminBranchList(payload: unknown, page: number): AdminBranchListView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize: 20,
      totalPages: 1,
    };
  }
  const list = asList(root.items ?? root.branches, ["items", "branches"]);
  const items = list.map(adaptListItem).filter((item): item is AdminBranchListItem => Boolean(item));
  const totalCount = readNumber(root.totalCount) ?? readNumber(root.total) ?? items.length;
  const pageSize = readNumber(root.pageSize) ?? readNumber(root.limit) ?? 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
    emptyCatalog: readBoolean(root.emptyCatalog) === true,
    filtersApplied: readBoolean(root.filtersApplied) === true,
  };
}

export function adaptAdminBranchDetail(payload: unknown): AdminBranchDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const listItem = adaptListItem(root);
  if (!listItem) return null;

  const schedule = adaptSchedule(root.schedule ?? root.scheduleSummary);
  const allowedActions = adaptAllowedActions(root.allowedActions);
  const capabilities = adaptCapabilities(root.capabilities);
  const rawActions = isRecord(root.allowedActions) ? root.allowedActions : {};
  const scheduleBlocked =
    readBoolean(rawActions.manageSchedule) === false ||
    readBoolean(rawActions.schedule) === false;
  const calendarBlocked = readBoolean(rawActions.viewCalendar) === false;
  const holidaysBlocked =
    readBoolean(rawActions.manageHolidays) === false ||
    readBoolean(rawActions.holidays) === false;

  return {
    ...listItem,
    schedule,
    location: adaptLocation(root.location),
    timezone: readString(root.timezone),
    staff: adaptStaffAssignments(root.staff ?? root.staffAssignments),
    resources: adaptResourceAssignments(root.resources ?? root.resourceAssignments),
    services: adaptServiceAssignments(root.services ?? root.serviceAssignments),
    holidaysSummary: asSafeText(root.holidaysSummary) ?? schedule.holidaysLabel,
    operationalWarnings: adaptWarnings(root.operationalWarnings ?? root.warnings),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    allowedActions,
    capabilities,
    scheduleHref: scheduleBlocked ? undefined : adminScheduleBranchHref(listItem.reference),
    calendarHref: calendarBlocked ? undefined : adminBranchCalendarHref(listItem.reference),
    holidaysHref: holidaysBlocked ? undefined : adminScheduleBranchHref(listItem.reference),
    editHref: adminBranchEditHref(listItem.reference),
  };
}

export function adaptAdminBranchImpactPreview(
  payload: unknown,
  action: AdminBranchImpactAction,
): AdminBranchImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش تأثیر";
  const summary = asSafeText(root.summary) ?? asSafeText(root.message) ?? "";
  const effects = asList(root.effects ?? root.impacts ?? root.warnings, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  return {
    action,
    title,
    summary,
    effects,
    futureAppointmentCount:
      typeof root.futureAppointmentCount === "number"
        ? root.futureAppointmentCount
        : typeof root.affectedAppointmentCount === "number"
          ? root.affectedAppointmentCount
          : undefined,
    waitingListAffected: readBoolean(root.waitingListAffected) === true,
    availabilityAffected: readBoolean(root.availabilityAffected) === true,
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason) ?? asSafeText(root.reason),
    contextId: readString(root.contextId) ?? readString(root.staffId) ?? readString(root.resourceId) ?? readString(root.serviceId),
    contextLabel: asSafeText(root.contextLabel),
  };
}

export function adaptAdminBranchMutationResult(payload: unknown): AdminBranchMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference = readString(root.reference) ?? readString(root.branchReference) ?? publicId(root.id);
  if (!reference) return null;
  return {
    reference,
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
  };
}

export function validateAdminBranchForm(input: AdminBranchFormInput): AdminBranchFormErrors {
  const errors: AdminBranchFormErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "نام شعبه الزامی است.";
  else if (name.length < 2) errors.name = "نام شعبه بسیار کوتاه است.";
  if (input.phone && input.phone.replace(/\D/g, "").length < 8) {
    errors.phone = "شماره تماس معتبر نیست.";
  }
  if (input.location?.latitude != null && (input.location.latitude < -90 || input.location.latitude > 90)) {
    errors.location = "عرض جغرافیایی نامعتبر است.";
  }
  if (input.location?.longitude != null && (input.location.longitude < -180 || input.location.longitude > 180)) {
    errors.location = "طول جغرافیایی نامعتبر است.";
  }
  return errors;
}

export function formFromAdminBranchDetail(detail?: AdminBranchDetailView | null): AdminBranchFormInput {
  const scheduleMode = detail?.schedule?.mode;
  return {
    name: detail?.name ?? "",
    publicTitle: detail?.publicTitle ?? "",
    address: detail?.address ?? "",
    phone: detail?.phone ?? "",
    location: detail?.location,
    timezone: detail?.timezone,
    scheduleMode:
      scheduleMode && scheduleMode !== "unknown" ? scheduleMode : "inherit_business",
    version: detail?.version,
  };
}

export function sanitizeAdminBranchBody(input: AdminBranchFormInput) {
  return {
    name: input.name.trim(),
    publicTitle: input.publicTitle?.trim() || undefined,
    address: input.address?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    location: input.location,
    timezone: input.timezone?.trim() || undefined,
    scheduleMode: input.scheduleMode,
    version: input.version,
  };
}

export function isAdminBranchConflict(error: { status?: number; code?: string }): boolean {
  return error.status === 409 || error.code?.includes("CONFLICT") === true || error.code?.includes("VERSION") === true;
}

export function adminBranchConflictMessage(): string {
  return "نسخه شعبه تغییر کرده است. داده تازه بارگذاری شد — تغییرات ذخیره نشده از بین رفت.";
}

export function isDuplicateBranchError(error: { status?: number; code?: string }): boolean {
  return error.status === 409 && (error.code?.includes("DUPLICATE") === true || error.code?.includes("EXISTS") === true);
}

export function adminBranchDuplicateMessage(): string {
  return "شعبه‌ای با این نام یا شناسه از قبل وجود دارد.";
}

export function branchFormImpactFields(input: AdminBranchFormInput, baseline: AdminBranchFormInput): AdminBranchFormImpactField[] {
  const fields: AdminBranchFormImpactField[] = [];
  if (input.name !== baseline.name || input.publicTitle !== baseline.publicTitle) fields.push("name");
  if (input.address !== baseline.address || JSON.stringify(input.location) !== JSON.stringify(baseline.location)) {
    fields.push("address", "location");
  }
  if (input.phone !== baseline.phone) fields.push("phone");
  if (input.timezone !== baseline.timezone) fields.push("timezone");
  if (input.scheduleMode !== baseline.scheduleMode) fields.push("scheduleMode");
  return fields;
}
