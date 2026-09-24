import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isInternalResource, readId } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { parseStatusKey } from "@/lib/status/status-map";
import { formatAppointmentParts } from "@/lib/date-time/format";
import type {
  AdminCalendarClosedPeriod,
  AdminCalendarColumn,
  AdminCalendarDaySummary,
  AdminCalendarEventType,
  AdminCalendarEventView,
  AdminCalendarFilterOptions,
  AdminCalendarPartialError,
  AdminCalendarView,
  AdminCalendarWorkingHours,
} from "@/types/admin-calendar";

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

function adaptEventType(value: unknown): AdminCalendarEventType | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "appointment" || raw === "booking") return "appointment";
  if (raw === "blocked" || raw === "blocked_time" || raw === "block") return "blocked";
  if (raw === "time_off" || raw === "timeoff" || raw === "leave" || raw === "unavailable") {
    return "time_off";
  }
  return undefined;
}

function buildAccessibleName(event: {
  type: AdminCalendarEventType;
  title: string;
  startsAt: string;
  endsAt: string;
  customerName?: string;
  serviceName?: string;
  statusLabel?: string;
  blockReason?: string;
  timeOffLabel?: string;
  timezone?: string;
}): string {
  const parts = formatAppointmentParts(event.startsAt, event.timezone);
  const time = parts ? parts.label : event.startsAt;
  if (event.type === "blocked") {
    return `زمان مسدود: ${event.blockReason ?? event.title}، ${time}`;
  }
  if (event.type === "time_off") {
    return `مرخصی/غیبت: ${event.timeOffLabel ?? event.title}، ${time}`;
  }
  const bits = [event.customerName ?? event.title, event.serviceName, event.statusLabel, time].filter(
    Boolean,
  );
  return bits.join("، ");
}

export function adaptAdminCalendarEvent(
  value: unknown,
  timezone?: string,
  canViewBlockReason = true,
): AdminCalendarEventView | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const type = adaptEventType(value.type ?? value.eventType ?? value.kind);
  if (!type) return null;
  const id = publicId(value.id) ?? publicId(value.eventId);
  const startsAt = readString(value.startsAt) ?? readString(value.start);
  const endsAt = readString(value.endsAt) ?? readString(value.end);
  if (!id || !startsAt || !endsAt) return null;

  const customerName = asSafeText(value.customerName) ??
    (isRecord(value.customer) ? asSafeText(value.customer.name) : undefined);
  const serviceName = asSafeText(value.serviceName) ??
    (isRecord(value.service) ? asSafeText(value.service.name) : undefined);
  const staffName = asSafeText(value.staffName) ?? asSafeText(value.providerName);
  const branchName = asSafeText(value.branchName) ??
    (isRecord(value.branch) ? asSafeText(value.branch.name) : undefined);
  const resourceName = asSafeText(value.resourceName);
  const title =
    asSafeText(value.title) ??
    customerName ??
    serviceName ??
    (type === "blocked" ? "زمان مسدود" : type === "time_off" ? "مرخصی" : "نوبت");

  const status = parseStatusKey(value.status) ?? parseStatusKey(value.appointmentStatus);
  const paymentStatus = parseStatusKey(value.paymentStatus);
  const appointmentReference =
    readString(value.appointmentReference) ??
    readString(value.reference) ??
    (type === "appointment" ? publicId(value.appointmentId) : undefined);

  const blockReason = canViewBlockReason
    ? asSafeText(value.blockReason) ?? asSafeText(value.reason)
    : undefined;
  const timeOffLabel = asSafeText(value.timeOffLabel) ?? asSafeText(value.label);

  const event: AdminCalendarEventView = {
    id,
    type,
    startsAt,
    endsAt,
    columnId:
      publicId(value.columnId) ??
      publicId(value.groupId) ??
      publicId(value.staffId) ??
      publicId(value.resourceId) ??
      publicId(value.branchId) ??
      "general",
    title,
    accessibleName: "",
    allDay: readBoolean(value.allDay) === true,
  };
  if (customerName) event.customerName = customerName;
  if (serviceName) event.serviceName = serviceName;
  if (staffName) event.staffName = staffName;
  if (branchName) event.branchName = branchName;
  if (resourceName) event.resourceName = resourceName;
  if (status) event.status = status;
  if (paymentStatus) event.paymentStatus = paymentStatus;
  if (appointmentReference) event.appointmentReference = appointmentReference;
  if (blockReason) event.blockReason = blockReason;
  if (timeOffLabel) event.timeOffLabel = timeOffLabel;

  event.accessibleName = buildAccessibleName({
    type,
    title,
    startsAt,
    endsAt,
    customerName,
    serviceName,
    statusLabel: status,
    blockReason,
    timeOffLabel,
    timezone,
  });
  return event;
}

function adaptColumn(value: unknown): AdminCalendarColumn | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const id = publicId(value.id) ?? readId(value) ?? "general";
  const label = asSafeText(value.label) ?? asSafeText(value.name) ?? id;
  const kindRaw = readString(value.kind ?? value.type)?.toLowerCase();
  const kind =
    kindRaw === "staff" || kindRaw === "resource" || kindRaw === "branch"
      ? kindRaw
      : "general";
  return { id, label, kind };
}

function adaptWorkingHours(value: unknown): AdminCalendarWorkingHours | null {
  if (!isRecord(value)) return null;
  const dayOfWeek = readNumber(value.dayOfWeek ?? value.weekday);
  const start = readString(value.start) ?? readString(value.from);
  const end = readString(value.end) ?? readString(value.to);
  if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6 || !start || !end) {
    return null;
  }
  return { dayOfWeek, start, end };
}

function adaptClosedPeriod(value: unknown): AdminCalendarClosedPeriod | null {
  if (!isRecord(value)) return null;
  const date = readString(value.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    reason: asSafeText(value.reason) ?? asSafeText(value.label),
    allDay: readBoolean(value.allDay) !== false,
  };
}

function adaptDaySummary(value: unknown): AdminCalendarDaySummary | null {
  if (!isRecord(value)) return null;
  const date = readString(value.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const count =
    readNumber(value.appointmentCount) ??
    readNumber(value.count) ??
    readNumber(value.appointments) ??
    0;
  const densityRaw = readString(value.density)?.toLowerCase();
  const density =
    densityRaw === "low" || densityRaw === "medium" || densityRaw === "high" || densityRaw === "none"
      ? densityRaw
      : count === 0
        ? "none"
        : count < 3
          ? "low"
          : count < 8
            ? "medium"
            : "high";
  return {
    date,
    appointmentCount: Math.max(0, Math.floor(count)),
    closed: readBoolean(value.closed) === true,
    closedReason: asSafeText(value.closedReason) ?? asSafeText(value.reason),
    density,
  };
}

function adaptFilterOptions(value: unknown): AdminCalendarFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const readOptions = (key: string, alt?: string) =>
    asList(value[key] ?? (alt ? value[alt] : undefined), ["items", "options"])
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = publicId(item.id) ?? publicId(item.value);
        const name = asSafeText(item.name) ?? asSafeText(item.label);
        if (!id || !name) return null;
        const type = asSafeText(item.type) ?? asSafeText(item.resourceType);
        return type ? { id, name, type } : { id, name };
      })
      .filter((item): item is { id: string; name: string; type?: string } => Boolean(item));

  const options: AdminCalendarFilterOptions = {};
  const services = readOptions("services");
  if (services.length) options.services = services;
  const staff = readOptions("staff", "providers");
  if (staff.length) options.staff = staff;
  const resources = readOptions("resources");
  if (resources.length) options.resources = resources;
  const branches = readOptions("branches");
  if (branches.length) options.branches = branches;
  const resourceTypes = asList(value.resourceTypes, ["items", "options"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const val = readString(item.value) ?? readString(item.id);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      if (!val || !label) return null;
      return { value: val, label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  if (resourceTypes.length) options.resourceTypes = resourceTypes;
  return Object.keys(options).length > 0 ? options : undefined;
}

function adaptPartialError(value: unknown): AdminCalendarPartialError | undefined {
  if (!isRecord(value)) return undefined;
  const message = asSafeText(value.message) ?? asSafeText(value.error);
  if (!message) return undefined;
  return { message, requestId: readString(value.requestId) };
}

export function adaptAdminCalendarView(
  payload: unknown,
  fallback: { from: string; to: string },
  options: { canViewBlockReason?: boolean } = {},
): AdminCalendarView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const timezone =
    readString(source.timezone) ?? readString(source.timeZone) ?? "Asia/Tehran";
  const weekStartsOn = readNumber(source.weekStartsOn) ?? readNumber(source.weekStart) ?? 6;
  const slotIntervalMinutes =
    readNumber(source.slotIntervalMinutes) ?? readNumber(source.slotInterval) ?? 15;

  const canViewBlockReason = options.canViewBlockReason !== false;
  const events = asList(source.events ?? source.items, ["items", "events"])
    .map((item) => adaptAdminCalendarEvent(item, timezone, canViewBlockReason))
    .filter((item): item is AdminCalendarEventView => Boolean(item));

  let columns = asList(source.columns ?? source.groups, ["items", "columns"])
    .map((item) => adaptColumn(item))
    .filter((item): item is AdminCalendarColumn => Boolean(item));
  if (columns.length === 0) {
    columns = [{ id: "general", label: "عمومی", kind: "general" }];
  }

  const workingHours = asList(source.workingHours ?? source.businessHours, ["items"])
    .map((item) => adaptWorkingHours(item))
    .filter((item): item is AdminCalendarWorkingHours => Boolean(item));

  const closedPeriods = asList(source.closedPeriods ?? source.holidays, ["items"])
    .map((item) => adaptClosedPeriod(item))
    .filter((item): item is AdminCalendarClosedPeriod => Boolean(item));

  const daySummaries = asList(source.daySummaries ?? source.days, ["items"])
    .map((item) => adaptDaySummary(item))
    .filter((item): item is AdminCalendarDaySummary => Boolean(item));

  const errorsRoot = isRecord(source.errors) ? source.errors : undefined;
  const partialErrors = errorsRoot
    ? {
        blockedTime: adaptPartialError(errorsRoot.blockedTime ?? errorsRoot.blocked),
        timeOff: adaptPartialError(errorsRoot.timeOff ?? errorsRoot.leave),
      }
    : undefined;

  return {
    from: readString(source.from) ?? fallback.from,
    to: readString(source.to) ?? fallback.to,
    timezone,
    weekStartsOn: weekStartsOn >= 0 && weekStartsOn <= 6 ? weekStartsOn : 6,
    slotIntervalMinutes: slotIntervalMinutes > 0 ? Math.floor(slotIntervalMinutes) : 15,
    serverNow: readString(source.serverNow),
    lastUpdatedAt: readString(source.lastUpdatedAt) ?? readString(source.updatedAt),
    workingHours,
    closedPeriods,
    columns,
    events,
    daySummaries,
    filterOptions: adaptFilterOptions(source.filterOptions ?? source.filters),
    emptyHistory: readBoolean(source.emptyHistory) === true,
    filtersApplied: readBoolean(source.filtersApplied) === true,
    noColumnsConfigured: readBoolean(source.noColumnsConfigured) === true,
    partialErrors:
      partialErrors && (partialErrors.blockedTime || partialErrors.timeOff)
        ? partialErrors
        : undefined,
  };
}
