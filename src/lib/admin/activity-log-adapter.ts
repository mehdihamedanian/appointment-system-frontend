import {
  adminActivityLogDetailHref,
} from "@/lib/admin/activity-log-filters";
import { formatAppointmentParts, formatRelativeTime } from "@/lib/date-time/format";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import {
  ADMIN_ACTIVITY_LOG_ACTION_LABELS,
  ADMIN_ACTIVITY_LOG_CHANGE_KIND_LABELS,
  ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS,
  ADMIN_ACTIVITY_LOG_LIST_LIMIT,
  ADMIN_ACTIVITY_LOG_RESULT_LABELS,
  SENSITIVE_ACTIVITY_LOG_FIELD_KEYS,
  type AdminActivityLogAllowedActions,
  type AdminActivityLogCapabilities,
  type AdminActivityLogChangeKind,
  type AdminActivityLogDetailView,
  type AdminActivityLogEntityLink,
  type AdminActivityLogEntityType,
  type AdminActivityLogExportJobView,
  type AdminActivityLogFieldChange,
  type AdminActivityLogFilterOptions,
  type AdminActivityLogListFilters,
  type AdminActivityLogListItemView,
  type AdminActivityLogListView,
  type AdminActivityLogResult,
} from "@/types/admin-activity-log";

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function isSensitiveActivityLogFieldKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[\s_-]+/g, "");
  return SENSITIVE_ACTIVITY_LOG_FIELD_KEYS.some((sensitive) => {
    const s = sensitive.toLowerCase().replace(/[\s_-]+/g, "");
    return lower === s || lower.includes(s);
  });
}

export function maskSensitiveActivityLogValue(
  fieldKey: string,
  display: string | undefined,
): { display: string; sensitive: boolean; hidden: boolean } {
  if (isSensitiveActivityLogFieldKey(fieldKey)) {
    return { display: "••••••••", sensitive: true, hidden: true };
  }
  if (display === undefined || display === "") {
    return { display: "—", sensitive: false, hidden: false };
  }
  return { display, sensitive: false, hidden: false };
}

export function mapActivityLogActionLabel(code: string): {
  label: string;
  known: boolean;
} {
  const trimmed = code.trim();
  if (!trimmed) return { label: "اقدام نامشخص", known: false };
  const mapped = ADMIN_ACTIVITY_LOG_ACTION_LABELS[trimmed];
  if (mapped) return { label: mapped, known: true };
  const lower = trimmed.toLowerCase();
  const mappedLower = ADMIN_ACTIVITY_LOG_ACTION_LABELS[lower];
  if (mappedLower) return { label: mappedLower, known: true };
  return { label: `اقدام ناشناخته (${trimmed})`, known: false };
}

export function adaptActivityLogEntityType(value: unknown): AdminActivityLogEntityType {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  if (raw === "appointment" || raw === "appointments") return "appointment";
  if (raw === "customer" || raw === "customers") return "customer";
  if (raw === "staff" || raw === "provider" || raw === "providers") return "staff";
  if (raw === "resource" || raw === "resources") return "resource";
  if (raw === "service" || raw === "services") return "service";
  if (raw === "payment" || raw === "payments") return "payment";
  if (raw === "coupon" || raw === "coupons") return "coupon";
  if (raw === "waiting_list" || raw === "waitinglist" || raw === "waitlist") {
    return "waiting_list";
  }
  if (raw === "admin_user" || raw === "user" || raw === "users") return "admin_user";
  if (raw === "role" || raw === "roles") return "role";
  if (raw === "settings" || raw === "setting") return "settings";
  if (raw === "branch" || raw === "branches") return "branch";
  if (raw === "notification" || raw === "notifications") return "notification";
  if (raw === "other") return "other";
  return "unknown";
}

export function adaptActivityLogResult(value: unknown): AdminActivityLogResult {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "success" || raw === "ok" || raw === "succeeded") return "success";
  if (raw === "failure" || raw === "failed" || raw === "error") return "failure";
  if (raw === "denied" || raw === "forbidden" || raw === "unauthorized") return "denied";
  if (raw === "partial") return "partial";
  return "unknown";
}

/**
 * Resolve deep link for a known entity. Never invent broken links for deleted entities.
 */
export function resolveActivityLogEntityLink(input: {
  entityType: AdminActivityLogEntityType;
  entityReference?: string;
  entityAvailable?: boolean;
  entityHref?: string;
  entityLabel?: string;
  unavailableReason?: string;
  settingsSection?: string;
}): AdminActivityLogEntityLink {
  const label =
    input.entityLabel ??
    (input.entityReference
      ? `${ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS[input.entityType]} ${input.entityReference}`
      : ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS[input.entityType]);

  if (input.entityAvailable === false) {
    return {
      label,
      available: false,
      unavailableReason:
        input.unavailableReason ?? "موجودیت حذف شده یا در دسترس نیست.",
    };
  }

  if (input.entityHref && input.entityHref.startsWith("/admin/")) {
    return { href: input.entityHref, label, available: true };
  }

  const ref = input.entityReference;
  if (!ref || (!isSafePublicId(ref) && !/^[A-Za-z0-9_.-]{1,80}$/.test(ref))) {
    return {
      label,
      available: false,
      unavailableReason: input.unavailableReason ?? "مرجع موجودیت معتبر نیست.",
    };
  }

  let href: string | undefined;
  switch (input.entityType) {
    case "appointment":
      href = routes.admin.appointmentDetail(ref);
      break;
    case "customer":
      href = routes.admin.customerDetail(ref);
      break;
    case "staff":
      href = routes.admin.staffDetail(ref);
      break;
    case "resource":
      href = routes.admin.resourceDetail(ref);
      break;
    case "service":
      href = routes.admin.serviceDetail(ref);
      break;
    case "payment":
      href = routes.admin.paymentDetail(ref);
      break;
    case "coupon":
      href = routes.admin.couponDetail(ref);
      break;
    case "waiting_list":
      href = routes.admin.waitingListDetail(ref);
      break;
    case "admin_user":
      href = routes.admin.userDetail(ref);
      break;
    case "role":
      href = routes.admin.roleDetail(ref);
      break;
    case "branch":
      href = routes.admin.branchDetail(ref);
      break;
    case "notification":
      href = routes.admin.notificationLogDetail(ref);
      break;
    case "settings": {
      const section = (input.settingsSection ?? ref).toLowerCase();
      if (section === "general") href = routes.admin.settingsGeneral;
      else if (section === "localization") href = routes.admin.settingsLocalization;
      else if (section === "booking") href = routes.admin.settingsBooking;
      else if (section === "payments") href = routes.admin.settingsPayments;
      else if (section === "notifications") href = routes.admin.settingsNotifications;
      else href = routes.admin.settings;
      break;
    }
    default:
      return {
        label,
        available: false,
        unavailableReason: "پیوند برای این نوع موجودیت تعریف نشده است.",
      };
  }

  return { href, label, available: true };
}

function formatDisplayValue(value: unknown, timezone?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("fa-IR").format(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((item) => formatDisplayValue(item, timezone))
      .filter((item) => item !== "—")
      .join("، ");
  }
  if (isRecord(value)) {
    const label =
      asSafeText(value.label) ??
      asSafeText(value.formatted) ??
      asSafeText(value.display) ??
      readString(value.amountLabel);
    if (label) return label;
    if (typeof value.amount === "number") {
      return String(value.amount);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  const raw = asSafeText(value) ?? readString(value);
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return formatAppointmentParts(raw, timezone)?.label ?? raw;
  }
  return raw;
}

export function adaptActivityLogChangeKind(value: unknown): AdminActivityLogChangeKind {
  const raw = readString(value)?.toLowerCase();
  if (raw === "added" || raw === "add" || raw === "created") return "added";
  if (raw === "removed" || raw === "remove" || raw === "deleted") return "removed";
  if (raw === "unchanged") return "unchanged";
  return "changed";
}

export function adaptActivityLogFieldChanges(
  value: unknown,
  options: { timezone?: string; canViewPrivate?: boolean } = {},
): AdminActivityLogFieldChange[] {
  const list = asList(value, ["changes", "diff", "fields", "items"]);
  return list
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const fieldKey =
        readString(item.fieldKey) ??
        readString(item.key) ??
        readString(item.field) ??
        readString(item.name) ??
        "";
      if (!fieldKey) return undefined;
      const kind = adaptActivityLogChangeKind(item.kind ?? item.changeType ?? item.op);
      const previousRaw =
        item.previousDisplay ??
        item.previous ??
        item.before ??
        item.oldValue ??
        item.from;
      const nextRaw =
        item.nextDisplay ?? item.next ?? item.after ?? item.newValue ?? item.to;
      const previousFormatted = formatDisplayValue(previousRaw, options.timezone);
      const nextFormatted = formatDisplayValue(nextRaw, options.timezone);
      const sensitive =
        isSensitiveActivityLogFieldKey(fieldKey) ||
        readBoolean(item.sensitive) === true;
      const backendHidden = readBoolean(item.hidden ?? item.redacted) === true;
      const canPrivate = options.canViewPrivate === true;
      const hidden = (sensitive && !canPrivate) || backendHidden;
      return {
        fieldKey,
        fieldLabel:
          asSafeText(item.fieldLabel) ?? asSafeText(item.label) ?? fieldKey,
        kind,
        kindLabel: ADMIN_ACTIVITY_LOG_CHANGE_KIND_LABELS[kind],
        previousDisplay: hidden ? "••••••••" : previousFormatted,
        nextDisplay: hidden ? "••••••••" : nextFormatted,
        sensitive,
        hidden,
      } satisfies AdminActivityLogFieldChange;
    })
    .filter((item): item is AdminActivityLogFieldChange => Boolean(item));
}

/**
 * Derive field-level changes from previous/new objects when Backend does not send a diff array.
 */
export function deriveActivityLogFieldChanges(
  previous: unknown,
  next: unknown,
  options: { timezone?: string; canViewPrivate?: boolean } = {},
): AdminActivityLogFieldChange[] {
  const prevObj = isRecord(previous) ? previous : {};
  const nextObj = isRecord(next) ? next : {};
  const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
  const changes: AdminActivityLogFieldChange[] = [];
  for (const fieldKey of keys) {
    const hasPrev = Object.prototype.hasOwnProperty.call(prevObj, fieldKey);
    const hasNext = Object.prototype.hasOwnProperty.call(nextObj, fieldKey);
    let kind: AdminActivityLogChangeKind = "changed";
    if (!hasPrev && hasNext) kind = "added";
    else if (hasPrev && !hasNext) kind = "removed";
    else {
      try {
        if (JSON.stringify(prevObj[fieldKey]) === JSON.stringify(nextObj[fieldKey])) {
          continue;
        }
      } catch {
        /* treat as changed */
      }
    }
    const previousFormatted = formatDisplayValue(prevObj[fieldKey], options.timezone);
    const nextFormatted = formatDisplayValue(nextObj[fieldKey], options.timezone);
    const sensitive = isSensitiveActivityLogFieldKey(fieldKey);
    const canPrivate = options.canViewPrivate === true;
    const hidden = sensitive && !canPrivate;
    changes.push({
      fieldKey,
      fieldLabel: fieldKey,
      kind,
      kindLabel: ADMIN_ACTIVITY_LOG_CHANGE_KIND_LABELS[kind],
      previousDisplay: hidden ? "••••••••" : previousFormatted,
      nextDisplay: hidden ? "••••••••" : nextFormatted,
      sensitive,
      hidden,
    });
  }
  return changes;
}

function adaptAllowedActions(value: unknown): AdminActivityLogAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    view: readBoolean(source.view) !== false,
    viewDetail: readBoolean(source.viewDetail ?? source.detail) !== false,
    viewChanges: readBoolean(source.viewChanges ?? source.changes) !== false,
    viewPrivate: readBoolean(source.viewPrivate ?? source.private) === true,
    viewSecurity: readBoolean(source.viewSecurity ?? source.security) === true,
    export: readBoolean(source.export) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminActivityLogCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsExport: readBoolean(source.supportsExport) === true,
    supportsBranchFilter: readBoolean(source.supportsBranchFilter) !== false,
    supportsRelativeTime: readBoolean(source.supportsRelativeTime) !== false,
  };
}

function adaptFilterOptions(value: unknown): AdminActivityLogFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const mapOptions = (raw: unknown) =>
    asList(raw, ["items", "options"])
      .map((item) => {
        if (!isRecord(item)) {
          const id = readString(item);
          return id ? { id, label: id } : undefined;
        }
        const id =
          readString(item.id) ?? readString(item.value) ?? readString(item.key);
        if (!id) return undefined;
        return {
          id,
          label: asSafeText(item.label) ?? asSafeText(item.name) ?? id,
        };
      })
      .filter((item): item is { id: string; label: string } => Boolean(item));
  return {
    actors: mapOptions(value.actors),
    actions: mapOptions(value.actions),
    entityTypes: mapOptions(value.entityTypes),
    branches: mapOptions(value.branches),
  };
}

function formatOccurredAt(iso: string | undefined, timezone?: string): string {
  if (!iso) return "—";
  return formatAppointmentParts(iso, timezone)?.label ?? asSafeText(iso) ?? iso;
}

function adaptListItem(
  value: unknown,
  timezone?: string,
): AdminActivityLogListItemView | undefined {
  if (!isRecord(value)) return undefined;
  const reference =
    readString(value.reference) ??
    readString(value.id) ??
    readString(value.logReference);
  if (!reference) return undefined;
  const actionCode =
    readString(value.actionCode) ??
    readString(value.action) ??
    readString(value.event) ??
    "";
  const mapped = mapActivityLogActionLabel(actionCode);
  const entityType = adaptActivityLogEntityType(
    value.entityType ?? value.resourceType ?? value.targetType,
  );
  const entityReference =
    readString(value.entityReference) ??
    readString(value.resourceReference) ??
    readString(value.targetReference) ??
    undefined;
  const result = adaptActivityLogResult(value.result ?? value.status ?? value.outcome);
  const occurredAt =
    readString(value.occurredAt) ??
    readString(value.createdAt) ??
    readString(value.timestamp) ??
    undefined;
  const entityAvailable = readBoolean(value.entityAvailable ?? value.entityExists);
  const entityLink = resolveActivityLogEntityLink({
    entityType,
    entityReference,
    entityAvailable: entityAvailable === false ? false : entityAvailable,
    entityHref: readString(value.entityHref) ?? undefined,
    entityLabel: asSafeText(value.entityLabel),
    unavailableReason: asSafeText(value.entityUnavailableReason),
    settingsSection: readString(value.settingsSection) ?? undefined,
  });

  return {
    reference,
    actorLabel:
      asSafeText(value.actorLabel) ??
      asSafeText(value.actorName) ??
      asSafeText(value.actor) ??
      "—",
    actorReference: readString(value.actorReference) ?? readString(value.actorId) ?? undefined,
    actionCode,
    actionLabel: asSafeText(value.actionLabel) ?? mapped.label,
    entityType,
    entityTypeLabel:
      asSafeText(value.entityTypeLabel) ?? ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS[entityType],
    entityReference,
    summary: asSafeText(value.summary) ?? asSafeText(value.description) ?? "—",
    occurredAt,
    occurredAtLabel:
      asSafeText(value.occurredAtLabel) ?? formatOccurredAt(occurredAt, timezone),
    relativeTimeLabel:
      asSafeText(value.relativeTimeLabel) ??
      (occurredAt ? formatRelativeTime(occurredAt) ?? undefined : undefined),
    result,
    resultLabel: asSafeText(value.resultLabel) ?? ADMIN_ACTIVITY_LOG_RESULT_LABELS[result],
    branchLabel: asSafeText(value.branchLabel) ?? asSafeText(value.branchName),
    detailHref: adminActivityLogDetailHref(reference),
    entityLink,
  };
}

export function adaptAdminActivityLogList(
  payload: unknown,
  filters: AdminActivityLogListFilters,
): AdminActivityLogListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const timezone =
    readString(source.timezone) ?? readString(source.timezoneLabel) ?? undefined;
  const items = asList(source, ["items", "logs", "results"])
    .map((item) => adaptListItem(item, timezone))
    .filter((item): item is AdminActivityLogListItemView => Boolean(item));
  const totalCount = readNumber(source.totalCount ?? source.total);
  const pageSize =
    readNumber(source.pageSize ?? source.limit) ?? ADMIN_ACTIVITY_LOG_LIST_LIMIT;
  const page = readNumber(source.page) ?? filters.page;
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof totalCount === "number" && page * pageSize < totalCount);
  const emptyHistory =
    readBoolean(source.emptyHistory) === true ||
    (items.length === 0 && !Boolean(source.filtersApplied));
  return {
    items,
    totalCount,
    page,
    pageSize,
    hasMore,
    emptyHistory,
    filtersApplied:
      readBoolean(source.filtersApplied) === true ||
      Boolean(filters.q) ||
      filters.action !== "all" ||
      filters.entityType !== "all" ||
      filters.result !== "all",
    filterOptions: adaptFilterOptions(source.filterOptions ?? source.meta),
    capabilities: adaptCapabilities(source.capabilities),
    allowedActions: adaptAllowedActions(source.allowedActions),
    timezoneLabel: asSafeText(source.timezoneLabel) ?? timezone,
  };
}

export function adaptAdminActivityLogDetail(
  payload: unknown,
  options: { canViewPrivate?: boolean; canViewChanges?: boolean } = {},
): AdminActivityLogDetailView | undefined {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return undefined;
  const reference =
    readString(root.reference) ??
    readString(root.id) ??
    readString(root.logReference);
  if (!reference) return undefined;

  const allowedActions = adaptAllowedActions(root.allowedActions);
  const capabilities = adaptCapabilities(root.capabilities);
  const timezone =
    readString(root.timezone) ?? readString(root.timezoneLabel) ?? undefined;
  const actionCode =
    readString(root.actionCode) ??
    readString(root.action) ??
    readString(root.event) ??
    "";
  const mapped = mapActivityLogActionLabel(actionCode);
  const entityType = adaptActivityLogEntityType(
    root.entityType ?? root.resourceType ?? root.targetType,
  );
  const entityReference =
    readString(root.entityReference) ??
    readString(root.resourceReference) ??
    readString(root.targetReference) ??
    undefined;
  const result = adaptActivityLogResult(root.result ?? root.status ?? root.outcome);
  const occurredAt =
    readString(root.occurredAt) ??
    readString(root.createdAt) ??
    readString(root.timestamp) ??
    undefined;

  const entityAvailable = readBoolean(root.entityAvailable ?? root.entityExists);
  const entityUnavailable =
    entityAvailable === false || readBoolean(root.entityUnavailable) === true;
  const entityLink = resolveActivityLogEntityLink({
    entityType,
    entityReference,
    entityAvailable: entityUnavailable ? false : entityAvailable,
    entityHref: readString(root.entityHref) ?? undefined,
    entityLabel: asSafeText(root.entityLabel),
    unavailableReason: asSafeText(root.entityUnavailableReason),
    settingsSection: readString(root.settingsSection) ?? undefined,
  });

  const isSecurityEvent = readBoolean(root.isSecurityEvent ?? root.security) === true;
  const securityHidden =
    isSecurityEvent &&
    allowedActions.viewSecurity !== true &&
    options.canViewPrivate !== true;

  const canViewChanges =
    options.canViewChanges !== false && allowedActions.viewChanges === true;
  let changes: AdminActivityLogFieldChange[] = [];
  let changesAvailable = false;
  let changesHiddenReason: string | undefined;

  if (!canViewChanges) {
    changesHiddenReason =
      allowedActions.blockedReason ?? "مجوز مشاهده تغییرات قبل/بعد را ندارید.";
  } else if (securityHidden) {
    changesHiddenReason = "جزئیات رویداد امنیتی برای شما قابل مشاهده نیست.";
  } else {
    changes = adaptActivityLogFieldChanges(root.changes ?? root.diff, {
      timezone,
      canViewPrivate: options.canViewPrivate === true || allowedActions.viewPrivate,
    });
    if (changes.length === 0 && (root.previousValues || root.newValues || root.before || root.after)) {
      changes = deriveActivityLogFieldChanges(
        root.previousValues ?? root.before,
        root.newValues ?? root.after,
        {
          timezone,
          canViewPrivate: options.canViewPrivate === true || allowedActions.viewPrivate,
        },
      );
    }
    changesAvailable = changes.length > 0 || readBoolean(root.changesAvailable) === true;
    if (!changesAvailable && readBoolean(root.changesRedacted) === true) {
      changesHiddenReason = "مقادیر قبل/بعد توسط Backend پنهان شده‌اند.";
    }
  }

  let structuredPayloadPreview: string | undefined;
  const structured = root.structuredPayload ?? root.payloadPreview;
  if (isRecord(structured) || Array.isArray(structured)) {
    try {
      const json = JSON.stringify(structured, null, 2);
      if (json && json.length < 8000) structuredPayloadPreview = json;
      else if (json) structuredPayloadPreview = `${json.slice(0, 8000)}\n…`;
    } catch {
      structuredPayloadPreview = undefined;
    }
  }

  return {
    reference,
    actorLabel:
      asSafeText(root.actorLabel) ??
      asSafeText(root.actorName) ??
      asSafeText(root.actor) ??
      "—",
    actorReference: readString(root.actorReference) ?? readString(root.actorId) ?? undefined,
    actionCode,
    actionLabel: asSafeText(root.actionLabel) ?? mapped.label,
    entityType,
    entityTypeLabel:
      asSafeText(root.entityTypeLabel) ?? ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS[entityType],
    entityReference,
    summary: asSafeText(root.summary) ?? asSafeText(root.description) ?? "—",
    occurredAt,
    occurredAtLabel:
      asSafeText(root.occurredAtLabel) ?? formatOccurredAt(occurredAt, timezone),
    occurredAtIso: occurredAt,
    relativeTimeLabel:
      asSafeText(root.relativeTimeLabel) ??
      (occurredAt ? formatRelativeTime(occurredAt) ?? undefined : undefined),
    result,
    resultLabel: asSafeText(root.resultLabel) ?? ADMIN_ACTIVITY_LOG_RESULT_LABELS[result],
    branchLabel: asSafeText(root.branchLabel) ?? asSafeText(root.branchName),
    branchId: readString(root.branchId) ?? undefined,
    sourceLabel: asSafeText(root.sourceLabel) ?? asSafeText(root.source),
    requestId: readString(root.requestId) ?? readString(root.correlationId) ?? undefined,
    changes,
    changesAvailable,
    changesHiddenReason,
    entityLink,
    entityUnavailable,
    entityUnavailableReason:
      asSafeText(root.entityUnavailableReason) ??
      (entityUnavailable ? "موجودیت حذف شده یا در دسترس نیست." : undefined),
    isSecurityEvent,
    securityHidden,
    timezoneLabel: asSafeText(root.timezoneLabel) ?? timezone,
    allowedActions,
    capabilities,
    structuredPayloadPreview,
  };
}

export function adaptAdminActivityLogExportJob(
  payload: unknown,
): AdminActivityLogExportJobView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const statusRaw = readString(source.status)?.toLowerCase();
  let status: AdminActivityLogExportJobView["status"] = "unknown";
  if (statusRaw === "preparing" || statusRaw === "pending" || statusRaw === "processing") {
    status = "preparing";
  } else if (statusRaw === "ready" || statusRaw === "completed" || statusRaw === "done") {
    status = "ready";
  } else if (statusRaw === "failed" || statusRaw === "error") {
    status = "failed";
  }
  return {
    jobId: readString(source.jobId) ?? readString(source.id) ?? "",
    status,
    downloadUrl: readString(source.downloadUrl) ?? readString(source.url) ?? undefined,
    message: asSafeText(source.message) ?? asSafeText(source.error),
  };
}
