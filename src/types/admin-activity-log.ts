/**
 * Admin Activity Logs (Phase 42) — immutable audit records (Frontend view models).
 * Events are Backend-authored only; the UI never fabricates production audit rows.
 */

export const ADMIN_ACTIVITY_LOGS_ENABLED = true;

export const ADMIN_ACTIVITY_LOG_LIST_LIMIT = 20;

export const ADMIN_ACTIVITY_LOG_SORT_FIELDS = [
  "occurredAt",
  "actor",
  "action",
  "entityType",
  "result",
] as const;

export type AdminActivityLogSortField = (typeof ADMIN_ACTIVITY_LOG_SORT_FIELDS)[number];
export type AdminActivityLogSortDirection = "asc" | "desc";

export const ADMIN_ACTIVITY_LOG_RESULT_FILTERS = [
  "all",
  "success",
  "failure",
  "denied",
  "partial",
] as const;

export type AdminActivityLogResultFilter = (typeof ADMIN_ACTIVITY_LOG_RESULT_FILTERS)[number];

export type AdminActivityLogResult =
  | "success"
  | "failure"
  | "denied"
  | "partial"
  | "unknown";

export type AdminActivityLogEntityType =
  | "appointment"
  | "customer"
  | "staff"
  | "resource"
  | "service"
  | "payment"
  | "coupon"
  | "waiting_list"
  | "admin_user"
  | "role"
  | "settings"
  | "branch"
  | "notification"
  | "other"
  | "unknown";

export type AdminActivityLogListFilters = {
  q?: string;
  actorReference?: string;
  action: string; // "all" or structured code
  entityType: string; // "all" or entity type
  result: AdminActivityLogResultFilter;
  branchId?: string;
  from?: string;
  to?: string;
  sort: AdminActivityLogSortField;
  direction: AdminActivityLogSortDirection;
  page: number;
};

export type AdminActivityLogFilterOption = {
  id: string;
  label: string;
};

export type AdminActivityLogFilterOptions = {
  actors?: AdminActivityLogFilterOption[];
  actions?: AdminActivityLogFilterOption[];
  entityTypes?: AdminActivityLogFilterOption[];
  branches?: AdminActivityLogFilterOption[];
};

export type AdminActivityLogAllowedActions = {
  view: boolean;
  viewDetail: boolean;
  viewChanges: boolean;
  viewPrivate: boolean;
  viewSecurity: boolean;
  export: boolean;
  blockedReason?: string;
};

export type AdminActivityLogCapabilities = {
  supportsExport: boolean;
  supportsBranchFilter: boolean;
  supportsRelativeTime: boolean;
};

export type AdminActivityLogEntityLink = {
  href?: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

export type AdminActivityLogListItemView = {
  reference: string;
  actorLabel: string;
  actorReference?: string;
  actionCode: string;
  actionLabel: string;
  entityType: AdminActivityLogEntityType;
  entityTypeLabel: string;
  entityReference?: string;
  summary: string;
  occurredAt?: string;
  occurredAtLabel: string;
  relativeTimeLabel?: string;
  result: AdminActivityLogResult;
  resultLabel: string;
  branchLabel?: string;
  detailHref: string;
  entityLink?: AdminActivityLogEntityLink;
};

export type AdminActivityLogListView = {
  items: AdminActivityLogListItemView[];
  totalCount?: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminActivityLogFilterOptions;
  capabilities: AdminActivityLogCapabilities;
  allowedActions: AdminActivityLogAllowedActions;
  timezoneLabel?: string;
};

export type AdminActivityLogChangeKind = "added" | "removed" | "changed" | "unchanged";

export type AdminActivityLogFieldChange = {
  fieldKey: string;
  fieldLabel: string;
  kind: AdminActivityLogChangeKind;
  kindLabel: string;
  previousDisplay: string;
  nextDisplay: string;
  sensitive: boolean;
  hidden: boolean;
};

export type AdminActivityLogDetailView = {
  reference: string;
  actorLabel: string;
  actorReference?: string;
  actionCode: string;
  actionLabel: string;
  entityType: AdminActivityLogEntityType;
  entityTypeLabel: string;
  entityReference?: string;
  summary: string;
  occurredAt?: string;
  occurredAtLabel: string;
  occurredAtIso?: string;
  relativeTimeLabel?: string;
  result: AdminActivityLogResult;
  resultLabel: string;
  branchLabel?: string;
  branchId?: string;
  sourceLabel?: string;
  requestId?: string;
  changes: AdminActivityLogFieldChange[];
  changesAvailable: boolean;
  changesHiddenReason?: string;
  entityLink?: AdminActivityLogEntityLink;
  entityUnavailable: boolean;
  entityUnavailableReason?: string;
  isSecurityEvent: boolean;
  securityHidden: boolean;
  timezoneLabel?: string;
  allowedActions: AdminActivityLogAllowedActions;
  capabilities: AdminActivityLogCapabilities;
  /** Collapsed structured payload for secondary inspection (sanitized). */
  structuredPayloadPreview?: string;
};

export type AdminActivityLogExportJobView = {
  jobId: string;
  status: "preparing" | "ready" | "failed" | "unknown";
  downloadUrl?: string;
  message?: string;
};

export const ADMIN_ACTIVITY_LOG_RESULT_LABELS: Record<AdminActivityLogResult, string> = {
  success: "موفق",
  failure: "ناموفق",
  denied: "رد شده",
  partial: "جزئی",
  unknown: "نامشخص",
};

export const ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS: Record<AdminActivityLogEntityType, string> = {
  appointment: "نوبت",
  customer: "مشتری",
  staff: "پرسنل",
  resource: "منبع",
  service: "خدمت",
  payment: "پرداخت",
  coupon: "کوپن",
  waiting_list: "لیست انتظار",
  admin_user: "کاربر مدیریت",
  role: "نقش",
  settings: "تنظیمات",
  branch: "شعبه",
  notification: "اعلان",
  other: "سایر",
  unknown: "نامشخص",
};

export const ADMIN_ACTIVITY_LOG_CHANGE_KIND_LABELS: Record<AdminActivityLogChangeKind, string> = {
  added: "افزوده‌شده",
  removed: "حذف‌شده",
  changed: "تغییر یافته",
  unchanged: "بدون تغییر",
};

/** Known structured action codes → Persian labels (fallback keeps code). */
export const ADMIN_ACTIVITY_LOG_ACTION_LABELS: Record<string, string> = {
  "appointment.created": "ایجاد نوبت",
  "appointment.cancelled": "لغو نوبت",
  "appointment.rescheduled": "بازمان‌بندی نوبت",
  "appointment.updated": "به‌روزرسانی نوبت",
  "payment.recorded": "ثبت پرداخت",
  "payment.refund_requested": "درخواست بازپرداخت",
  "payment.refunded": "بازپرداخت",
  "staff.created": "ایجاد پرسنل",
  "staff.updated": "به‌روزرسانی پرسنل",
  "staff.deactivated": "غیرفعال‌سازی پرسنل",
  "customer.created": "ایجاد مشتری",
  "customer.updated": "به‌روزرسانی مشتری",
  "service.created": "ایجاد خدمت",
  "service.updated": "به‌روزرسانی خدمت",
  "resource.created": "ایجاد منبع",
  "resource.updated": "به‌روزرسانی منبع",
  "coupon.created": "ایجاد کوپن",
  "coupon.updated": "به‌روزرسانی کوپن",
  "waiting_list.created": "ثبت لیست انتظار",
  "waiting_list.offer_sent": "ارسال پیشنهاد لیست انتظار",
  "admin_user.invited": "دعوت کاربر مدیریت",
  "admin_user.updated": "به‌روزرسانی کاربر مدیریت",
  "admin_user.deactivated": "غیرفعال‌سازی کاربر مدیریت",
  "role.created": "ایجاد نقش",
  "role.updated": "به‌روزرسانی نقش",
  "role.deleted": "حذف نقش",
  "settings.general_updated": "به‌روزرسانی تنظیمات عمومی",
  "settings.localization_updated": "به‌روزرسانی زبان و منطقه",
  "settings.booking_updated": "به‌روزرسانی تنظیمات نوبت‌دهی",
  "settings.payments_updated": "به‌روزرسانی تنظیمات پرداخت",
  "settings.notifications_updated": "به‌روزرسانی تنظیمات اعلان",
  "branch.created": "ایجاد شعبه",
  "branch.updated": "به‌روزرسانی شعبه",
  "notification.template_updated": "به‌روزرسانی قالب اعلان",
};

export const SENSITIVE_ACTIVITY_LOG_FIELD_KEYS = [
  "password",
  "otp",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "secretKey",
  "apiKey",
  "cookie",
  "session",
  "authorization",
  "cardNumber",
  "pan",
  "cvv",
  "cvc",
  "gatewaySecret",
  "credentials",
  "privateKey",
] as const;
