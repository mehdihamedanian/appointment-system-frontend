import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  ADMIN_NOTIFICATION_CHANNEL_FILTERS,
  ADMIN_NOTIFICATION_EVENT_FILTERS,
  ADMIN_NOTIFICATION_LOG_SORT_FIELDS,
  ADMIN_NOTIFICATION_LOG_STATUS_FILTERS,
  ADMIN_NOTIFICATION_TEMPLATE_SORT_FIELDS,
  ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS,
  type AdminNotificationChannelFilter,
  type AdminNotificationEventFilter,
  type AdminNotificationLogListFilters,
  type AdminNotificationLogSortField,
  type AdminNotificationLogStatusFilter,
  type AdminNotificationSortDirection,
  type AdminNotificationTemplateListFilters,
  type AdminNotificationTemplateSortField,
  type AdminNotificationTemplateStatusFilter,
} from "@/types/admin-notification";

export function sanitizeNotificationSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function parseAdminNotificationPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAdminNotificationEventFilter(
  value: string | null | undefined,
): AdminNotificationEventFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_NOTIFICATION_EVENT_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminNotificationEventFilter;
  }
  return "all";
}

export function parseAdminNotificationChannelFilter(
  value: string | null | undefined,
): AdminNotificationChannelFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_NOTIFICATION_CHANNEL_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminNotificationChannelFilter;
  }
  return "all";
}

export function parseAdminNotificationTemplateStatusFilter(
  value: string | null | undefined,
): AdminNotificationTemplateStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminNotificationTemplateStatusFilter;
  }
  return "all";
}

export function parseAdminNotificationLogStatusFilter(
  value: string | null | undefined,
): AdminNotificationLogStatusFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_NOTIFICATION_LOG_STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminNotificationLogStatusFilter;
  }
  return "all";
}

export function parseAdminNotificationTemplateSort(
  value: string | null | undefined,
): AdminNotificationTemplateSortField {
  const raw = value?.trim() as AdminNotificationTemplateSortField | undefined;
  if (raw && ADMIN_NOTIFICATION_TEMPLATE_SORT_FIELDS.includes(raw)) return raw;
  return "updatedAt";
}

export function parseAdminNotificationLogSort(
  value: string | null | undefined,
): AdminNotificationLogSortField {
  const raw = value?.trim() as AdminNotificationLogSortField | undefined;
  if (raw && ADMIN_NOTIFICATION_LOG_SORT_FIELDS.includes(raw)) return raw;
  return "sentAt";
}

export function parseAdminNotificationDirection(
  value: string | null | undefined,
): AdminNotificationSortDirection {
  return value?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function sanitizeIsoDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

function sanitizeReferenceFilter(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) return undefined;
  return raw;
}

function sanitizeLanguage(value: string | null | undefined): string | undefined {
  const raw = value?.trim().toLowerCase();
  if (!raw || !/^[a-z]{2}(-[a-z]{2})?$/.test(raw)) return undefined;
  return raw;
}

export function parseAdminNotificationTemplateFilters(search: {
  get(name: string): string | null;
}): AdminNotificationTemplateListFilters {
  const filters: AdminNotificationTemplateListFilters = {
    eventType: parseAdminNotificationEventFilter(search.get("eventType")),
    channel: parseAdminNotificationChannelFilter(search.get("channel")),
    status: parseAdminNotificationTemplateStatusFilter(search.get("status")),
    sort: parseAdminNotificationTemplateSort(search.get("sort")),
    direction: parseAdminNotificationDirection(search.get("direction")),
    page: parseAdminNotificationPage(search.get("page")),
  };
  const q = sanitizeNotificationSearch(search.get("q"));
  if (q) filters.q = q;
  const language = sanitizeLanguage(search.get("language"));
  if (language) filters.language = language;
  const branchId = sanitizeReferenceFilter(search.get("branchId"));
  if (branchId) filters.branchId = branchId;
  return filters;
}

export function parseAdminNotificationLogFilters(search: {
  get(name: string): string | null;
}): AdminNotificationLogListFilters {
  const filters: AdminNotificationLogListFilters = {
    eventType: parseAdminNotificationEventFilter(search.get("eventType")),
    channel: parseAdminNotificationChannelFilter(search.get("channel")),
    status: parseAdminNotificationLogStatusFilter(search.get("status")),
    sort: parseAdminNotificationLogSort(search.get("sort")),
    direction: parseAdminNotificationDirection(search.get("direction")),
    page: parseAdminNotificationPage(search.get("page")),
  };
  const q = sanitizeNotificationSearch(search.get("q"));
  if (q) filters.q = q;
  const templateReference = sanitizeReferenceFilter(search.get("templateReference"));
  if (templateReference) filters.templateReference = templateReference;
  const branchId = sanitizeReferenceFilter(search.get("branchId"));
  if (branchId) filters.branchId = branchId;
  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  return filters;
}

export function adminNotificationTemplateFiltersApplied(
  filters: AdminNotificationTemplateListFilters,
): boolean {
  return (
    Boolean(filters.q) ||
    filters.eventType !== "all" ||
    filters.channel !== "all" ||
    filters.status !== "all" ||
    Boolean(filters.language) ||
    Boolean(filters.branchId)
  );
}

export function adminNotificationLogFiltersApplied(
  filters: AdminNotificationLogListFilters,
): boolean {
  return (
    Boolean(filters.q) ||
    filters.eventType !== "all" ||
    filters.channel !== "all" ||
    filters.status !== "all" ||
    Boolean(filters.templateReference) ||
    Boolean(filters.branchId) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

export function countActiveAdminNotificationTemplateFilters(
  filters: AdminNotificationTemplateListFilters,
): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.eventType !== "all") count += 1;
  if (filters.channel !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.language) count += 1;
  if (filters.branchId) count += 1;
  return count;
}

export function countActiveAdminNotificationLogFilters(
  filters: AdminNotificationLogListFilters,
): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.eventType !== "all") count += 1;
  if (filters.channel !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.templateReference) count += 1;
  if (filters.branchId) count += 1;
  if (filters.from || filters.to) count += 1;
  return count;
}

export function adminNotificationTemplatesHref(
  input: Partial<AdminNotificationTemplateListFilters> = {},
): string {
  const filters: AdminNotificationTemplateListFilters = {
    eventType: input.eventType ?? "all",
    channel: input.channel ?? "all",
    status: input.status ?? "all",
    sort: input.sort ?? "updatedAt",
    direction: input.direction ?? "desc",
    page: input.page ?? 1,
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.eventType !== "all") params.set("eventType", filters.eventType);
  if (filters.channel !== "all") params.set("channel", filters.channel);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.language) params.set("language", filters.language);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.sort !== "updatedAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query
    ? `${routes.admin.notificationTemplates}?${query}`
    : routes.admin.notificationTemplates;
}

export function adminNotificationLogsHref(
  input: Partial<AdminNotificationLogListFilters> = {},
): string {
  const filters: AdminNotificationLogListFilters = {
    eventType: input.eventType ?? "all",
    channel: input.channel ?? "all",
    status: input.status ?? "all",
    sort: input.sort ?? "sentAt",
    direction: input.direction ?? "desc",
    page: input.page ?? 1,
    ...input,
  };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.eventType !== "all") params.set("eventType", filters.eventType);
  if (filters.channel !== "all") params.set("channel", filters.channel);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.templateReference) params.set("templateReference", filters.templateReference);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== "sentAt") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${routes.admin.notificationLogs}?${query}` : routes.admin.notificationLogs;
}

export function adminNotificationTemplateDetailHref(reference: string): string {
  return routes.admin.notificationTemplateDetail(reference);
}

export function adminNotificationLogDetailHref(reference: string): string {
  return routes.admin.notificationLogDetail(reference);
}

export function filtersToAdminNotificationTemplateParams(
  filters: AdminNotificationTemplateListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.eventType !== "all") params.eventType = filters.eventType;
  if (filters.channel !== "all") params.channel = filters.channel;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.language) params.language = filters.language;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.sort !== "updatedAt") params.sort = filters.sort;
  if (filters.direction !== "desc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function filtersToAdminNotificationLogParams(
  filters: AdminNotificationLogListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.eventType !== "all") params.eventType = filters.eventType;
  if (filters.channel !== "all") params.channel = filters.channel;
  if (filters.status !== "all") params.status = filters.status;
  if (filters.templateReference) params.templateReference = filters.templateReference;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.sort !== "sentAt") params.sort = filters.sort;
  if (filters.direction !== "desc") params.direction = filters.direction;
  if (filters.page > 1) params.page = String(filters.page);
  return params;
}

export function notificationPermission(
  action:
    | "view"
    | "templatesView"
    | "templatesEdit"
    | "templatesToggle"
    | "logsView"
    | "logsRetry"
    | "logsSensitive",
): string {
  switch (action) {
    case "view":
      return "admin.notifications.view";
    case "templatesView":
      return "admin.notifications.templates.view";
    case "templatesEdit":
      return "admin.notifications.templates.edit";
    case "templatesToggle":
      return "admin.notifications.templates.toggle";
    case "logsView":
      return "admin.notifications.logs.view";
    case "logsRetry":
      return "admin.notifications.logs.retry";
    case "logsSensitive":
      return "admin.notifications.logs.view_sensitive";
    default:
      return "admin.notifications.view";
  }
}
