import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import { adminResourceCalendarHref } from "@/lib/admin/resource-filters";
import {
  ADMIN_RESOURCE_LIFECYCLE_LABELS,
  ADMIN_RESOURCE_SCHEDULE_MODE_LABELS,
  ADMIN_RESOURCE_TYPE_LABELS,
  type AdminResourceAllowedActions,
  type AdminResourceCapacityView,
  type AdminResourceDetailView,
  type AdminResourceFilterOptions,
  type AdminResourceImpactAction,
  type AdminResourceImpactPreview,
  type AdminResourceLifecycle,
  type AdminResourceListItem,
  type AdminResourceListView,
  type AdminResourceMutationResult,
  type AdminResourceScheduleMode,
  type AdminResourceScheduleSummary,
  type AdminResourceType,
  type AdminResourceTypeOption,
} from "@/types/admin-resource";

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

export function adaptAdminResourceType(value: unknown): AdminResourceType {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  const map: Record<string, AdminResourceType> = {
    staff: "staff",
    specialist: "staff",
    provider: "staff",
    employee: "staff",
    room: "room",
    device: "device",
    machine: "device",
    desk: "desk",
    chair: "chair",
    bed: "bed",
    equipment: "equipment",
    other: "other",
  };
  return map[raw] ?? "unknown";
}

export function adaptAdminResourceLifecycle(value: unknown): AdminResourceLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled") return "inactive";
  if (raw === "archived" || raw === "archive") return "archived";
  if (readBoolean(value) === true) return "active";
  if (readBoolean(value) === false) return "inactive";
  return "unknown";
}

function adaptScheduleMode(value: unknown): AdminResourceScheduleMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "inherit_business" || raw === "business") return "inherit_business";
  if (raw === "inherit_branch" || raw === "branch") return "inherit_branch";
  if (raw === "custom" || raw === "resource") return "custom";
  return "unknown";
}

function adaptCapacity(value: unknown): AdminResourceCapacityView | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, editable: true, label: String(value) };
  }
  if (!isRecord(value)) return undefined;
  const capacity: AdminResourceCapacityView = {
    editable: readBoolean(value.editable) !== false,
  };
  const num = readNumber(value.value ?? value.capacity ?? value.amount);
  if (num !== undefined) {
    capacity.value = num;
    capacity.label = asSafeText(value.label) ?? String(num);
  }
  const min = readNumber(value.min ?? value.minimum);
  if (min !== undefined) capacity.min = min;
  const max = readNumber(value.max ?? value.maximum);
  if (max !== undefined) capacity.max = max;
  const semantics = asSafeText(value.semanticsLabel) ?? asSafeText(value.help) ?? asSafeText(value.description);
  if (semantics) capacity.semanticsLabel = semantics;
  return capacity;
}

function adaptSchedule(value: unknown): AdminResourceScheduleSummary {
  if (!isRecord(value)) {
    return { mode: "unknown" };
  }
  const mode = adaptScheduleMode(value.mode ?? value.scheduleMode);
  const summary: AdminResourceScheduleSummary = { mode };
  const sourceLabel = asSafeText(value.sourceLabel) ?? asSafeText(value.source);
  if (sourceLabel) summary.sourceLabel = sourceLabel;
  else if (mode !== "unknown") summary.sourceLabel = ADMIN_RESOURCE_SCHEDULE_MODE_LABELS[mode];
  const text = asSafeText(value.summary) ?? asSafeText(value.label);
  if (text) summary.summary = text;
  const working = asSafeText(value.workingHoursLabel) ?? asSafeText(value.workingHours);
  if (working) summary.workingHoursLabel = working;
  const breaks = asSafeText(value.breaksLabel) ?? asSafeText(value.breaks);
  if (breaks) summary.breaksLabel = breaks;
  const timeOff = asSafeText(value.timeOffLabel) ?? asSafeText(value.timeOff);
  if (timeOff) summary.timeOffLabel = timeOff;
  const block = asSafeText(value.blockTimeLabel) ?? asSafeText(value.blockedTime);
  if (block) summary.blockTimeLabel = block;
  return summary;
}

function adaptAllowedActions(value: unknown): AdminResourceAllowedActions {
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
    manageSchedule: read("manageSchedule", "schedule"),
    changeBranch: read("changeBranch", "transferBranch"),
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

/** Backend `ResourceRead.resource_type` is an object; `ResourceListItem` flattens it. */
function readTypeCode(value: Record<string, unknown>): unknown {
  const nested = value.resourceType ?? value.resource_type;
  if (isRecord(nested)) return nested.code;
  return value.type ?? value.kind ?? nested ?? value.resource_type_code;
}

function readTypeDisplayName(value: Record<string, unknown>): string | undefined {
  const nested = value.resourceType ?? value.resource_type;
  if (isRecord(nested)) return asSafeText(nested.display_name) ?? asSafeText(nested.displayName);
  return asSafeText(value.resource_type_display_name);
}

function firstBranch(value: Record<string, unknown>): { id: string; name: string } | undefined {
  const source = isRecord(value.branch) ? value.branch : asList(value.branches, ["items"])[0];
  if (!isRecord(source)) return undefined;
  const id = publicId(source.id);
  const name = asSafeText(source.name);
  return id && name ? { id, name } : undefined;
}

function adaptListItem(value: unknown): AdminResourceListItem | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id) ?? publicId(value.resourceId);
  const reference =
    readString(value.reference) ?? readString(value.resourceReference) ?? id;
  const name = asSafeText(value.name) ?? asSafeText(value.title);
  if (!id || !reference || !name) return null;
  const type = adaptAdminResourceType(readTypeCode(value));
  const lifecycle = adaptAdminResourceLifecycle(
    value.lifecycle ?? value.status ?? value.active ?? value.is_active ?? value.state,
  );
  const item: AdminResourceListItem = {
    id,
    reference,
    name,
    type,
    typeLabel:
      asSafeText(value.typeLabel) ??
      (type === "unknown" ? readTypeDisplayName(value) : undefined) ??
      ADMIN_RESOURCE_TYPE_LABELS[type],
    lifecycle,
    lifecycleLabel:
      asSafeText(value.lifecycleLabel) ?? ADMIN_RESOURCE_LIFECYCLE_LABELS[lifecycle],
    allowedActions: adaptAllowedActions(value),
  };
  const description = asSafeText(value.description);
  if (description) item.description = description;
  const branch = firstBranch(value);
  if (branch) item.branch = branch;
  const capacity = adaptCapacity(value.capacity);
  if (capacity) item.capacity = capacity;
  if (isRecord(value.schedule) || value.scheduleSummary) {
    item.schedule = adaptSchedule(value.schedule ?? value.scheduleSummary);
  }
  const related = readNumber(value.relatedServiceCount ?? value.serviceCount);
  if (related !== undefined) item.relatedServiceCount = related;
  const staffRef = publicId(value.staffReference) ?? publicId(value.staffId);
  if (type === "staff" && staffRef) {
    item.staffHref = routes.admin.staffDetail(staffRef);
  }
  return item;
}

function adaptFilterOptions(value: unknown): AdminResourceFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminResourceFilterOptions = {};
  const types = asList(value.types, ["items", "options"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const val = readString(item.value) ?? readString(item.id);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      if (!val || !label) return null;
      return { value: val, label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  if (types.length) options.types = types;
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
  return Object.keys(options).length ? options : undefined;
}

export function adaptAdminResourceList(payload: unknown, page: number): AdminResourceListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(source, ["items", "resources", "results"])
    .map((item) => adaptListItem(item))
    .filter((item): item is AdminResourceListItem => Boolean(item));
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
    emptyCatalog: readBoolean(source.emptyCatalog) === true || readBoolean(source.emptyHistory) === true,
    filterOptions: adaptFilterOptions(source.filterOptions ?? source.filters),
  };
}

export function adaptAdminResourceDetail(payload: unknown): AdminResourceDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const listItem = adaptListItem(root);
  if (!listItem) return null;

  const relatedServices = asList(root.relatedServices ?? root.services, ["items"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id);
      const name = asSafeText(item.name);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is { id: string; name: string } => Boolean(item));

  const staffReference = publicId(root.staffReference) ?? publicId(root.staffId);
  const customerVisible = readBoolean(root.customerVisible) === true;
  const customerVisibilityAllowed =
    readBoolean(root.customerVisibilityAllowed) === true ||
    (listItem.type === "staff" && readBoolean(root.canSetCustomerVisible) !== false);

  const capabilitiesSource = isRecord(root.capabilities) ? root.capabilities : root;
  const hasCapacity =
    readBoolean(capabilitiesSource.hasCapacity) === true || Boolean(listItem.capacity);
  const hasBranch =
    readBoolean(capabilitiesSource.hasBranch) === true || Boolean(listItem.branch);
  const hasSchedule = readBoolean(capabilitiesSource.hasSchedule) !== false;
  const hasCalendar = readBoolean(capabilitiesSource.hasCalendar) !== false;
  const canSetCustomerVisible =
    readBoolean(capabilitiesSource.canSetCustomerVisible) === true || customerVisibilityAllowed;

  return {
    id: listItem.id,
    reference: listItem.reference,
    name: listItem.name,
    type: listItem.type,
    typeLabel: listItem.typeLabel,
    description: listItem.description,
    branch: listItem.branch,
    capacity: listItem.capacity,
    lifecycle: listItem.lifecycle,
    lifecycleLabel: listItem.lifecycleLabel,
    customerVisible,
    customerVisibilityAllowed: canSetCustomerVisible,
    schedule: listItem.schedule ?? adaptSchedule(root.schedule ?? root.scheduleSummary),
    relatedServices,
    staffReference,
    staffHref:
      listItem.type === "staff" && staffReference
        ? routes.admin.staffDetail(staffReference)
        : undefined,
    calendarHref: hasCalendar ? adminResourceCalendarHref(listItem.id) : undefined,
    scheduleManageHref: undefined,
    allowedActions: listItem.allowedActions,
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    capabilities: {
      hasCapacity,
      hasBranch,
      hasSchedule,
      hasCalendar,
      canSetCustomerVisible,
    },
  };
}

export function adaptAdminResourceImpactPreview(
  payload: unknown,
  action: AdminResourceImpactAction,
): AdminResourceImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const effects = asList(root.effects ?? root.impacts, ["items"])
    .map((item) => (typeof item === "string" ? asSafeText(item) : isRecord(item) ? asSafeText(item.label) ?? asSafeText(item.message) : undefined))
    .filter((item): item is string => Boolean(item));
  const summary =
    asSafeText(root.summary) ?? asSafeText(root.message) ?? "این تغییر ممکن است روی نوبت‌ها و زمان‌بندی اثر بگذارد.";
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
  };
}

export function adaptAdminResourceMutationResult(
  payload: unknown,
): AdminResourceMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    readString(root.reference) ??
    readString(root.resourceReference) ??
    publicId(root.id);
  if (!reference) return null;
  return {
    reference,
    lifecycle: adaptAdminResourceLifecycle(root.lifecycle ?? root.status ?? root.state),
    message: asSafeText(root.message),
    version: readString(root.version),
    updatedAt: readString(root.updatedAt),
  };
}

export function isAdminResourceConflict(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("STALE");
}

export function adminResourceConflictMessage(): string {
  return "این منبع توسط فرد دیگری به‌روزرسانی شده است. لطفاً آخرین نسخه را بررسی کنید.";
}

export function isDuplicateResourceError(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) {
    const code = error.code?.toUpperCase() ?? "";
    return code.includes("DUPLICATE") || code.includes("EXISTS");
  }
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("DUPLICATE") || code.includes("EXISTS");
}

const HUMAN_RESOURCE_TYPE_CODES = new Set(["staff", "specialist"]);

/** `GET /resources/types` → selectable options; IDs come only from the Backend. */
export function adaptAdminResourceTypeOptions(payload: unknown): AdminResourceTypeOption[] {
  return asList(unwrapPayload(payload), ["items", "types"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id);
      const code = readString(item.code)?.toLowerCase();
      if (!id || !code) return null;
      const type = adaptAdminResourceType(code);
      const label =
        code === "specialist"
          ? "متخصص"
          : type !== "unknown"
            ? ADMIN_RESOURCE_TYPE_LABELS[type]
            : asSafeText(item.display_name) ?? asSafeText(item.displayName) ?? code;
      return { id, code, type, label, human: HUMAN_RESOURCE_TYPE_CODES.has(code) };
    })
    .filter((item): item is AdminResourceTypeOption => Boolean(item));
}

/** Internal operational types must never be treated as customer-visible providers. */
export function isInternalOperationalResourceType(type: AdminResourceType): boolean {
  return type !== "staff" && type !== "unknown";
}
