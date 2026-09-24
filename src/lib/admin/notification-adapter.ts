import {
  adminNotificationLogDetailHref,
  adminNotificationLogFiltersApplied,
  adminNotificationTemplateDetailHref,
  adminNotificationTemplateFiltersApplied,
} from "@/lib/admin/notification-filters";
import { findUnknownTemplateTokens } from "@/lib/admin/notification-sms";
import { channelLabel } from "@/lib/customer/profile-adapter";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import type { NotificationChannel } from "@/types/customer-profile";
import {
  ADMIN_NOTIFICATION_DELIVERY_STATUS_LABELS,
  ADMIN_NOTIFICATION_EVENT_TYPE_LABELS,
  ADMIN_NOTIFICATION_EVENT_TYPES,
  type AdminNotificationDeliveryStatus,
  type AdminNotificationEventType,
  type AdminNotificationLogDetailView,
  type AdminNotificationLogListFilters,
  type AdminNotificationLogListItemView,
  type AdminNotificationLogListView,
  type AdminNotificationLogTimelineEntry,
  type AdminNotificationPreviewInput,
  type AdminNotificationPreviewResult,
  type AdminNotificationTemplateAllowedActions,
  type AdminNotificationTemplateCapabilities,
  type AdminNotificationTemplateContent,
  type AdminNotificationTemplateDetailView,
  type AdminNotificationTemplateListFilters,
  type AdminNotificationTemplateListItemView,
  type AdminNotificationTemplateListView,
  type AdminNotificationTemplateSaveInput,
  type AdminNotificationTemplateVariable,
  type AdminNotificationToggleImpactPreview,
} from "@/types/admin-notification";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || /^\d+$/.test(raw)) return undefined;
  return raw;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function parseAdminNotificationEventType(value: unknown): AdminNotificationEventType {
  const raw = readString(value)?.toLowerCase();
  if (raw && (ADMIN_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(raw)) {
    return raw as AdminNotificationEventType;
  }
  return "unknown";
}

export function parseAdminNotificationDeliveryStatus(
  value: unknown,
): AdminNotificationDeliveryStatus {
  const raw = readString(value)?.toLowerCase();
  switch (raw) {
    case "queued":
    case "pending":
      return "queued";
    case "processing":
    case "in_progress":
      return "processing";
    case "sent":
      return "sent";
    case "delivered":
    case "success":
      return "delivered";
    case "failed":
    case "error":
      return "failed";
    case "bounced":
      return "bounced";
    case "rejected":
      return "rejected";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function parseAdminNotificationChannel(value: unknown): NotificationChannel | undefined {
  const raw = readString(value)?.toLowerCase();
  if (raw === "sms" || raw === "email") return raw;
  return undefined;
}

function eventTypeLabel(eventType: AdminNotificationEventType): string {
  if (eventType === "unknown") return "نامشخص";
  return ADMIN_NOTIFICATION_EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function deliveryStatusLabel(status: AdminNotificationDeliveryStatus): string {
  return ADMIN_NOTIFICATION_DELIVERY_STATUS_LABELS[status];
}

function adaptAllowedActions(value: unknown): AdminNotificationTemplateAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    view: readBoolean(source.view) !== false,
    edit: readBoolean(source.edit) === true,
    preview: readBoolean(source.preview) !== false,
    enable: readBoolean(source.enable) === true,
    disable: readBoolean(source.disable) === true,
    viewVariables: readBoolean(source.viewVariables) !== false,
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminNotificationTemplateCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsMultilingual: readBoolean(source.supportsMultilingual) === true,
    supportsBranchScope: readBoolean(source.supportsBranchScope) === true,
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsHtmlPreview: readBoolean(source.supportsHtmlPreview) === true,
    supportsPlainTextFallback: readBoolean(source.supportsPlainTextFallback) !== false,
    supportsPreviewText: readBoolean(source.supportsPreviewText) !== false,
  };
}

function adaptFilterOptions(value: unknown) {
  if (!isRecord(value)) return undefined;
  const mapOptions = (key: string) =>
    asList(value, [key]).map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.reference) ?? readString(item.code);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      return id && label ? { id, label } : null;
    }).filter((item): item is { id: string; label: string } => Boolean(item));

  const languages = mapOptions("languages");
  const branches = asList(value, ["branches"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = publicId(item.id) ?? publicId(item.reference);
    const name = asSafeText(item.name);
    return id && name ? { id, name } : null;
  }).filter((item): item is { id: string; name: string } => Boolean(item));
  const templates = mapOptions("templates");

  const options: NonNullable<AdminNotificationTemplateListView["filterOptions"]> = {};
  if (languages.length) options.languages = languages;
  if (branches.length) options.branches = branches;
  if (templates.length) options.templates = templates;
  return Object.keys(options).length > 0 ? options : undefined;
}

function adaptContent(value: unknown, channel: NotificationChannel): AdminNotificationTemplateContent {
  const root = isRecord(value) ? value : {};
  const content: AdminNotificationTemplateContent = {};
  if (channel === "sms") {
    const smsBody = asSafeText(root.smsBody ?? root.body ?? root.text);
    if (smsBody) content.smsBody = smsBody;
  } else {
    const emailSubject = asSafeText(root.emailSubject ?? root.subject);
    if (emailSubject) content.emailSubject = emailSubject;
    const emailPreviewText = asSafeText(root.emailPreviewText ?? root.previewText);
    if (emailPreviewText) content.emailPreviewText = emailPreviewText;
    const emailBody = asSafeText(root.emailBody ?? root.bodyHtml ?? root.body);
    if (emailBody) content.emailBody = emailBody;
    const emailPlainText = asSafeText(root.emailPlainText ?? root.plainText ?? root.textBody);
    if (emailPlainText) content.emailPlainText = emailPlainText;
  }
  const direction = readString(root.direction)?.toLowerCase();
  if (direction === "rtl" || direction === "ltr" || direction === "auto") {
    content.direction = direction;
  }
  return content;
}

function adaptVariables(value: unknown): AdminNotificationTemplateVariable[] {
  return asList(value, ["variables", "allowedVariables", "tokens"]).map((item) => {
    if (!isRecord(item)) return null;
    const token = readString(item.token) ?? readString(item.key) ?? readString(item.name);
    const label = asSafeText(item.label) ?? token;
    if (!token || !label) return null;
    const variable: AdminNotificationTemplateVariable = { token, label };
    const description = asSafeText(item.description);
    if (description) variable.description = description;
    const sampleValue = asSafeText(item.sampleValue ?? item.example);
    if (sampleValue) variable.sampleValue = sampleValue;
    if (readBoolean(item.required) === true) variable.required = true;
    return variable;
  }).filter((item): item is AdminNotificationTemplateVariable => Boolean(item));
}

export function adaptAdminNotificationTemplateListItem(
  value: unknown,
): AdminNotificationTemplateListItemView | null {
  if (!isRecord(value)) return null;
  const reference = publicId(value.reference) ?? publicId(value.templateReference) ?? publicId(value.id);
  const channel = parseAdminNotificationChannel(value.channel);
  if (!reference || !channel) return null;
  const eventType = parseAdminNotificationEventType(value.eventType ?? value.event);
  const language = readString(value.language) ?? readString(value.locale) ?? "fa";
  const allowedActions = adaptAllowedActions(value.allowedActions);
  const item: AdminNotificationTemplateListItemView = {
    reference,
    eventType,
    eventTypeLabel: asSafeText(value.eventTypeLabel) ?? eventTypeLabel(eventType),
    channel,
    channelLabel: asSafeText(value.channelLabel) ?? channelLabel(channel),
    language,
    languageLabel: asSafeText(value.languageLabel) ?? language,
    enabled: readBoolean(value.enabled) !== false,
    required: readBoolean(value.required) === true,
    system: readBoolean(value.system) === true,
    detailHref: adminNotificationTemplateDetailHref(reference),
    canViewDetail: allowedActions.view !== false,
    canEdit: allowedActions.edit === true,
  };
  const branchName = asSafeText(value.branchName);
  if (branchName) item.branchName = branchName;
  const updatedAtLabel = asSafeText(value.updatedAtLabel ?? value.updatedAt);
  if (updatedAtLabel) item.updatedAtLabel = updatedAtLabel;
  return item;
}

export function adaptAdminNotificationTemplateList(
  payload: unknown,
  filters: AdminNotificationTemplateListFilters,
): AdminNotificationTemplateListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "templates", "results"])
    .map((item) => adaptAdminNotificationTemplateListItem(item))
    .filter((item): item is AdminNotificationTemplateListItemView => Boolean(item));

  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof pageCount === "number" && typeof page === "number" && pageCount > page);
  const filtersOn = adminNotificationTemplateFiltersApplied(filters);
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && items.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: AdminNotificationTemplateListView = {
    items,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore,
    emptyHistory,
    filtersApplied: filtersOn,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;
  const filterOptions = adaptFilterOptions(source.filterOptions ?? source.filters);
  if (filterOptions) view.filterOptions = filterOptions;
  const fallbackLanguage = readString(source.fallbackLanguage);
  if (fallbackLanguage) view.fallbackLanguage = fallbackLanguage;
  return view;
}

export function adaptAdminNotificationTemplateDetail(
  payload: unknown,
): AdminNotificationTemplateDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference = publicId(root.reference) ?? publicId(root.templateReference) ?? publicId(root.id);
  const channel = parseAdminNotificationChannel(root.channel);
  if (!reference || !channel) return null;

  const eventType = parseAdminNotificationEventType(root.eventType ?? root.event);
  const language = readString(root.language) ?? readString(root.locale) ?? "fa";
  const variables = adaptVariables(root);
  const content = adaptContent(root.content ?? root, channel);
  const allowedActions = adaptAllowedActions(root.allowedActions);

  const detail: AdminNotificationTemplateDetailView = {
    reference,
    eventType,
    eventTypeLabel: asSafeText(root.eventTypeLabel) ?? eventTypeLabel(eventType),
    channel,
    channelLabel: asSafeText(root.channelLabel) ?? channelLabel(channel),
    language,
    languageLabel: asSafeText(root.languageLabel) ?? language,
    enabled: readBoolean(root.enabled) !== false,
    required: readBoolean(root.required) === true,
    system: readBoolean(root.system) === true,
    content,
    variables,
    allowedActions,
    capabilities: adaptCapabilities(root.capabilities),
  };

  const branchId = publicId(root.branchId);
  if (branchId) detail.branchId = branchId;
  const branchName = asSafeText(root.branchName);
  if (branchName) detail.branchName = branchName;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;
  const updatedAtLabel = asSafeText(root.updatedAtLabel ?? root.updatedAt);
  if (updatedAtLabel) detail.updatedAtLabel = updatedAtLabel;

  const languageVersions = asList(root, ["languageVersions", "translations"]).map((item) => {
    if (!isRecord(item)) return null;
    const lang = readString(item.language) ?? readString(item.locale);
    const langRef = publicId(item.reference) ?? publicId(item.templateReference);
    if (!lang) return null;
    return {
      language: lang,
      languageLabel: asSafeText(item.languageLabel) ?? lang,
      href: langRef ? adminNotificationTemplateDetailHref(langRef) : adminNotificationTemplateDetailHref(reference),
      complete: readBoolean(item.complete) !== false,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (languageVersions.length) detail.languageVersions = languageVersions;

  const textParts = [
    content.smsBody,
    content.emailSubject,
    content.emailPreviewText,
    content.emailBody,
    content.emailPlainText,
  ].filter(Boolean) as string[];
  const allowedTokens = variables.map((v) => v.token);
  const invalid = [...new Set(textParts.flatMap((part) => findUnknownTemplateTokens(part, allowedTokens)))];
  if (invalid.length) detail.invalidVariables = invalid;

  return detail;
}

export function adaptAdminNotificationToggleImpactPreview(
  payload: unknown,
): AdminNotificationToggleImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش اثر";
  const preview: AdminNotificationToggleImpactPreview = {
    title,
    effects: asList(root, ["effects", "items"]).map((item) => asSafeText(item)).filter(Boolean) as string[],
  };
  const summary = asSafeText(root.summary) ?? asSafeText(root.description);
  if (summary) preview.summary = summary;
  const fallbackChannelLabel = asSafeText(root.fallbackChannelLabel ?? root.fallbackChannel);
  if (fallbackChannelLabel) preview.fallbackChannelLabel = fallbackChannelLabel;
  if (readBoolean(root.blocked) === true) preview.blocked = true;
  const blockedReason = asSafeText(root.blockedReason);
  if (blockedReason) preview.blockedReason = blockedReason;
  if (readBoolean(root.requiresConfirmation) !== false) preview.requiresConfirmation = true;
  const confirmLabel = asSafeText(root.confirmLabel);
  if (confirmLabel) preview.confirmLabel = confirmLabel;
  const previewVersion = readString(root.previewVersion) ?? readString(root.version);
  if (previewVersion) preview.previewVersion = previewVersion;
  return preview;
}

export function adaptAdminNotificationPreviewResult(
  payload: unknown,
): AdminNotificationPreviewResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const warnings = asList(root, ["warnings", "messages"]).map((item) => asSafeText(item)).filter(Boolean) as string[];
  const invalidVariables = asList(root, ["invalidVariables", "unknownVariables"]).map((item) => readString(item) ?? asSafeText(item)).filter(Boolean) as string[];
  const result: AdminNotificationPreviewResult = { warnings, invalidVariables };
  const smsBody = asSafeText(root.smsBody ?? root.renderedSms);
  if (smsBody) result.smsBody = smsBody;
  const emailSubject = asSafeText(root.emailSubject ?? root.renderedSubject);
  if (emailSubject) result.emailSubject = emailSubject;
  const emailPreviewText = asSafeText(root.emailPreviewText ?? root.renderedPreviewText);
  if (emailPreviewText) result.emailPreviewText = emailPreviewText;
  const emailBodyPlain = asSafeText(root.emailBodyPlain ?? root.renderedPlainText);
  if (emailBodyPlain) result.emailBodyPlain = emailBodyPlain;
  const emailBodyHtml = asSafeText(root.emailBodyHtml ?? root.renderedHtml);
  if (emailBodyHtml) result.emailBodyHtml = emailBodyHtml;
  const direction = readString(root.direction)?.toLowerCase();
  if (direction === "rtl" || direction === "ltr" || direction === "auto") {
    result.direction = direction;
  }
  const segmentCountLabel = asSafeText(root.segmentCountLabel ?? root.smsSegmentsLabel);
  if (segmentCountLabel) result.segmentCountLabel = segmentCountLabel;
  const characterCountLabel = asSafeText(root.characterCountLabel);
  if (characterCountLabel) result.characterCountLabel = characterCountLabel;
  return result;
}

export function validateAdminNotificationTemplateSave(
  input: AdminNotificationTemplateSaveInput,
  channel: NotificationChannel,
  variables: AdminNotificationTemplateVariable[],
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  const allowedTokens = variables.map((v) => v.token);
  if (channel === "sms") {
    const body = input.content.smsBody?.trim() ?? "";
    if (!body) errors.smsBody = "متن پیامک الزامی است.";
    const unknown = findUnknownTemplateTokens(body, allowedTokens);
    if (unknown.length) errors.smsBody = `متغیرهای نامعتبر: ${unknown.join(", ")}`;
  } else {
    if (!input.content.emailSubject?.trim()) errors.emailSubject = "موضوع ایمیل الزامی است.";
    if (!input.content.emailBody?.trim() && !input.content.emailPlainText?.trim()) {
      errors.emailBody = "متن ایمیل الزامی است.";
    }
    const parts = [
      input.content.emailSubject,
      input.content.emailPreviewText,
      input.content.emailBody,
      input.content.emailPlainText,
    ].filter(Boolean) as string[];
    const unknown = [...new Set(parts.flatMap((part) => findUnknownTemplateTokens(part, allowedTokens)))];
    if (unknown.length) errors.form = `متغیرهای نامعتبر: ${unknown.join(", ")}`;
  }
  return errors;
}

export function sanitizeAdminNotificationTemplateBody(
  input: AdminNotificationTemplateSaveInput,
  channel: NotificationChannel,
) {
  const body: Record<string, unknown> = { content: {} };
  const content = body.content as Record<string, unknown>;
  if (channel === "sms") {
    content.smsBody = input.content.smsBody?.trim();
  } else {
    if (input.content.emailSubject?.trim()) content.emailSubject = input.content.emailSubject.trim();
    if (input.content.emailPreviewText?.trim()) {
      content.emailPreviewText = input.content.emailPreviewText.trim();
    }
    if (input.content.emailBody?.trim()) content.emailBody = input.content.emailBody.trim();
    if (input.content.emailPlainText?.trim()) {
      content.emailPlainText = input.content.emailPlainText.trim();
    }
    if (input.content.direction) content.direction = input.content.direction;
  }
  if (input.version) body.version = input.version;
  return body;
}

export function adaptAdminNotificationLogListItem(
  value: unknown,
): AdminNotificationLogListItemView | null {
  if (!isRecord(value)) return null;
  const reference = publicId(value.reference) ?? publicId(value.logReference) ?? publicId(value.id);
  const channel = parseAdminNotificationChannel(value.channel);
  const maskedRecipient = asSafeText(value.maskedRecipient ?? value.recipientMasked ?? value.recipient);
  if (!reference || !channel || !maskedRecipient) return null;

  const eventType = parseAdminNotificationEventType(value.eventType ?? value.event);
  const deliveryStatus = parseAdminNotificationDeliveryStatus(value.status ?? value.deliveryStatus);
  const canRetry = readBoolean(value.canRetry) === true || readBoolean(isRecord(value.allowedActions) ? value.allowedActions.retry : undefined) === true;

  const item: AdminNotificationLogListItemView = {
    reference,
    sentAtLabel: asSafeText(value.sentAtLabel ?? value.createdAtLabel ?? value.timestampLabel) ?? "—",
    eventType,
    eventTypeLabel: asSafeText(value.eventTypeLabel) ?? eventTypeLabel(eventType),
    channel,
    channelLabel: asSafeText(value.channelLabel) ?? channelLabel(channel),
    maskedRecipient,
    deliveryStatus,
    deliveryStatusLabel: asSafeText(value.statusLabel) ?? deliveryStatusLabel(deliveryStatus),
    detailHref: adminNotificationLogDetailHref(reference),
    canViewDetail: true,
    canRetry,
  };

  const templateReference = publicId(value.templateReference);
  if (templateReference) item.templateReference = templateReference;
  const templateVersionLabel = asSafeText(value.templateVersionLabel ?? value.templateVersion);
  if (templateVersionLabel) item.templateVersionLabel = templateVersionLabel;
  const relatedCustomerLabel = asSafeText(value.customerName ?? value.relatedCustomerLabel);
  if (relatedCustomerLabel) item.relatedCustomerLabel = relatedCustomerLabel;
  const customerReference = publicId(value.customerReference);
  if (customerReference) item.relatedCustomerHref = routes.admin.customerDetail(customerReference);
  const relatedAppointmentLabel = asSafeText(value.appointmentLabel ?? value.relatedAppointmentLabel);
  if (relatedAppointmentLabel) item.relatedAppointmentLabel = relatedAppointmentLabel;
  const appointmentReference = publicId(value.appointmentReference);
  if (appointmentReference) {
    item.relatedAppointmentHref = routes.admin.appointmentDetail(appointmentReference);
  }
  const branchName = asSafeText(value.branchName);
  if (branchName) item.branchName = branchName;
  return item;
}

export function adaptAdminNotificationLogList(
  payload: unknown,
  filters: AdminNotificationLogListFilters,
): AdminNotificationLogListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "logs", "results"])
    .map((item) => adaptAdminNotificationLogListItem(item))
    .filter((item): item is AdminNotificationLogListItemView => Boolean(item));

  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof pageCount === "number" && typeof page === "number" && pageCount > page);
  const filtersOn = adminNotificationLogFiltersApplied(filters);
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && items.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: AdminNotificationLogListView = {
    items,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore,
    emptyHistory,
    filtersApplied: filtersOn,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;
  const filterOptions = adaptFilterOptions(source.filterOptions ?? source.filters);
  if (filterOptions) view.filterOptions = filterOptions;
  return view;
}

function adaptTimeline(value: unknown): AdminNotificationLogTimelineEntry[] {
  return asList(value, ["timeline", "statusHistory", "events"]).map((item, index) => {
    if (!isRecord(item)) return null;
    const status = parseAdminNotificationDeliveryStatus(item.status);
    const atLabel = asSafeText(item.atLabel ?? item.timestampLabel ?? item.createdAtLabel);
    if (!atLabel) return null;
    const entry: AdminNotificationLogTimelineEntry = {
      id: readString(item.id) ?? `timeline-${index}`,
      status,
      statusLabel: asSafeText(item.statusLabel) ?? deliveryStatusLabel(status),
      atLabel,
    };
    const detail = asSafeText(item.detail ?? item.message);
    if (detail) entry.detail = detail;
    return entry;
  }).filter((item): item is AdminNotificationLogTimelineEntry => Boolean(item));
}

export function adaptAdminNotificationLogDetail(payload: unknown): AdminNotificationLogDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference = publicId(root.reference) ?? publicId(root.logReference) ?? publicId(root.id);
  const channel = parseAdminNotificationChannel(root.channel);
  const maskedRecipient = asSafeText(root.maskedRecipient ?? root.recipientMasked ?? root.recipient);
  if (!reference || !channel || !maskedRecipient) return null;

  const eventType = parseAdminNotificationEventType(root.eventType ?? root.event);
  const deliveryStatus = parseAdminNotificationDeliveryStatus(root.status ?? root.deliveryStatus);
  const allowedSource = isRecord(root.allowedActions) ? root.allowedActions : {};

  const detail: AdminNotificationLogDetailView = {
    reference,
    sentAtLabel: asSafeText(root.sentAtLabel ?? root.createdAtLabel) ?? "—",
    eventType,
    eventTypeLabel: asSafeText(root.eventTypeLabel) ?? eventTypeLabel(eventType),
    channel,
    channelLabel: asSafeText(root.channelLabel) ?? channelLabel(channel),
    maskedRecipient,
    deliveryStatus,
    deliveryStatusLabel: asSafeText(root.statusLabel) ?? deliveryStatusLabel(deliveryStatus),
    timeline: adaptTimeline(root),
    allowedActions: {
      retry: readBoolean(allowedSource.retry) === true,
      viewSensitive: readBoolean(allowedSource.viewSensitive) === true,
      blockedReason: asSafeText(allowedSource.blockedReason),
    },
  };

  const templateReference = publicId(root.templateReference);
  if (templateReference) {
    detail.templateReference = templateReference;
    detail.templateHref = adminNotificationTemplateDetailHref(templateReference);
  }
  const templateVersionLabel = asSafeText(root.templateVersionLabel ?? root.templateVersion);
  if (templateVersionLabel) detail.templateVersionLabel = templateVersionLabel;
  const relatedCustomerLabel = asSafeText(root.customerName ?? root.relatedCustomerLabel);
  if (relatedCustomerLabel) detail.relatedCustomerLabel = relatedCustomerLabel;
  const customerReference = publicId(root.customerReference);
  if (customerReference) detail.relatedCustomerHref = routes.admin.customerDetail(customerReference);
  const relatedAppointmentLabel = asSafeText(root.appointmentLabel ?? root.relatedAppointmentLabel);
  if (relatedAppointmentLabel) detail.relatedAppointmentLabel = relatedAppointmentLabel;
  const appointmentReference = publicId(root.appointmentReference);
  if (appointmentReference) {
    detail.relatedAppointmentHref = routes.admin.appointmentDetail(appointmentReference);
  }
  const branchName = asSafeText(root.branchName);
  if (branchName) detail.branchName = branchName;
  const errorCategory = asSafeText(root.errorCategory);
  if (errorCategory) detail.errorCategory = errorCategory;
  const errorMessage = asSafeText(root.errorMessage ?? root.failureReason);
  if (errorMessage) detail.errorMessage = errorMessage;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;
  return detail;
}

export function isAdminNotificationConflict(error: { status?: number; code?: string }): boolean {
  return error.status === 409 || error.code?.includes("CONFLICT") === true || error.code?.includes("VERSION") === true;
}

export function adminNotificationConflictMessage(): string {
  return "قالب توسط کاربر دیگری تغییر کرده است. لطفاً صفحه را به‌روز کنید.";
}

export function buildAdminNotificationPreviewInput(
  reference: string,
  content: AdminNotificationTemplateContent,
  detail?: Pick<AdminNotificationTemplateDetailView, "eventType" | "channel" | "language">,
): AdminNotificationPreviewInput {
  return {
    content,
    eventType: detail?.eventType,
    channel: detail?.channel,
    language: detail?.language,
  };
}
