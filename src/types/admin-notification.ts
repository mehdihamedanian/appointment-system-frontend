import type { NotificationChannel } from "@/types/customer-profile";

export const ADMIN_NOTIFICATION_MANAGEMENT_ENABLED = true;
export const ADMIN_NOTIFICATION_TEMPLATE_LIST_LIMIT = 20;
export const ADMIN_NOTIFICATION_LOG_LIST_LIMIT = 20;

/** Backend event keys — unknown values map to `unknown`. */
export const ADMIN_NOTIFICATION_EVENT_TYPES = [
  "booking_confirmation",
  "reminder",
  "cancellation",
  "reschedule",
  "payment",
  "refund",
  "waiting_list_offer",
  "review_request",
  "other",
] as const;

export type AdminNotificationEventType =
  | (typeof ADMIN_NOTIFICATION_EVENT_TYPES)[number]
  | "unknown";

export const ADMIN_NOTIFICATION_EVENT_TYPE_LABELS: Record<
  Exclude<AdminNotificationEventType, "unknown">,
  string
> = {
  booking_confirmation: "تأیید نوبت",
  reminder: "یادآوری",
  cancellation: "لغو نوبت",
  reschedule: "تغییر زمان",
  payment: "پرداخت",
  refund: "استرداد",
  waiting_list_offer: "پیشنهاد لیست انتظار",
  review_request: "درخواست نظر",
  other: "سایر",
};

export const ADMIN_NOTIFICATION_CHANNEL_FILTERS = ["all", "sms", "email"] as const;
export type AdminNotificationChannelFilter = (typeof ADMIN_NOTIFICATION_CHANNEL_FILTERS)[number];

export const ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS = [
  "all",
  "enabled",
  "disabled",
  "required",
] as const;
export type AdminNotificationTemplateStatusFilter =
  (typeof ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS)[number];

export const ADMIN_NOTIFICATION_EVENT_FILTERS = [
  "all",
  ...ADMIN_NOTIFICATION_EVENT_TYPES,
] as const;
export type AdminNotificationEventFilter = (typeof ADMIN_NOTIFICATION_EVENT_FILTERS)[number];

export const ADMIN_NOTIFICATION_TEMPLATE_SORT_FIELDS = [
  "eventType",
  "channel",
  "language",
  "updatedAt",
  "enabled",
] as const;
export type AdminNotificationTemplateSortField =
  (typeof ADMIN_NOTIFICATION_TEMPLATE_SORT_FIELDS)[number];

export const ADMIN_NOTIFICATION_LOG_SORT_FIELDS = [
  "sentAt",
  "eventType",
  "channel",
  "status",
  "createdAt",
] as const;
export type AdminNotificationLogSortField = (typeof ADMIN_NOTIFICATION_LOG_SORT_FIELDS)[number];

export type AdminNotificationSortDirection = "asc" | "desc";

export type AdminNotificationDeliveryStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "rejected"
  | "cancelled"
  | "unknown";

export const ADMIN_NOTIFICATION_DELIVERY_STATUS_LABELS: Record<
  AdminNotificationDeliveryStatus,
  string
> = {
  queued: "در صف",
  processing: "در حال پردازش",
  sent: "ارسال‌شده",
  delivered: "تحویل‌شده",
  failed: "ناموفق",
  bounced: "برگشت‌خورده",
  rejected: "رد شده",
  cancelled: "لغو شده",
  unknown: "نامشخص",
};

export const ADMIN_NOTIFICATION_LOG_STATUS_FILTERS = [
  "all",
  "queued",
  "processing",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "rejected",
  "cancelled",
] as const;
export type AdminNotificationLogStatusFilter =
  (typeof ADMIN_NOTIFICATION_LOG_STATUS_FILTERS)[number];

export type AdminNotificationTemplateListFilters = {
  q?: string;
  eventType: AdminNotificationEventFilter;
  channel: AdminNotificationChannelFilter;
  language?: string;
  status: AdminNotificationTemplateStatusFilter;
  branchId?: string;
  sort: AdminNotificationTemplateSortField;
  direction: AdminNotificationSortDirection;
  page: number;
};

export type AdminNotificationLogListFilters = {
  q?: string;
  eventType: AdminNotificationEventFilter;
  channel: AdminNotificationChannelFilter;
  status: AdminNotificationLogStatusFilter;
  templateReference?: string;
  branchId?: string;
  from?: string;
  to?: string;
  sort: AdminNotificationLogSortField;
  direction: AdminNotificationSortDirection;
  page: number;
};

export type AdminNotificationTemplateAllowedActions = {
  view?: boolean;
  edit?: boolean;
  preview?: boolean;
  enable?: boolean;
  disable?: boolean;
  viewVariables?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminNotificationTemplateCapabilities = {
  supportsMultilingual?: boolean;
  supportsBranchScope?: boolean;
  supportsImpactPreview?: boolean;
  supportsHtmlPreview?: boolean;
  supportsPlainTextFallback?: boolean;
  supportsPreviewText?: boolean;
};

export type AdminNotificationTemplateListItemView = {
  reference: string;
  eventType: AdminNotificationEventType;
  eventTypeLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  language: string;
  languageLabel: string;
  enabled: boolean;
  required: boolean;
  system: boolean;
  branchName?: string;
  updatedAtLabel?: string;
  detailHref: string;
  canViewDetail: boolean;
  canEdit: boolean;
};

export type AdminNotificationTemplateListView = {
  items: AdminNotificationTemplateListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: {
    languages?: Array<{ id: string; label: string }>;
    branches?: Array<{ id: string; name: string }>;
    templates?: Array<{ id: string; label: string }>;
  };
  fallbackLanguage?: string;
};

export type AdminNotificationTemplateContent = {
  smsBody?: string;
  emailSubject?: string;
  emailPreviewText?: string;
  emailBody?: string;
  emailPlainText?: string;
  direction?: "rtl" | "ltr" | "auto";
};

export type AdminNotificationTemplateVariable = {
  token: string;
  label: string;
  description?: string;
  sampleValue?: string;
  required?: boolean;
};

export type AdminNotificationTemplateDetailView = {
  reference: string;
  eventType: AdminNotificationEventType;
  eventTypeLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  language: string;
  languageLabel: string;
  enabled: boolean;
  required: boolean;
  system: boolean;
  branchId?: string;
  branchName?: string;
  version?: string;
  updatedAtLabel?: string;
  content: AdminNotificationTemplateContent;
  variables: AdminNotificationTemplateVariable[];
  allowedActions: AdminNotificationTemplateAllowedActions;
  capabilities: AdminNotificationTemplateCapabilities;
  languageVersions?: Array<{
    language: string;
    languageLabel: string;
    href: string;
    complete: boolean;
  }>;
  invalidVariables?: string[];
};

export type AdminNotificationTemplateSaveInput = {
  content: AdminNotificationTemplateContent;
  version?: string;
};

export type AdminNotificationTemplateSaveErrors = Partial<
  Record<keyof AdminNotificationTemplateContent | "form", string>
>;

export type AdminNotificationToggleImpactPreview = {
  title: string;
  summary?: string;
  effects: string[];
  fallbackChannelLabel?: string;
  blocked?: boolean;
  blockedReason?: string;
  requiresConfirmation?: boolean;
  confirmLabel?: string;
  previewVersion?: string;
};

export type AdminNotificationToggleAction = "enable" | "disable";

export type AdminNotificationPreviewInput = {
  content: AdminNotificationTemplateContent;
  eventType?: AdminNotificationEventType;
  channel?: NotificationChannel;
  language?: string;
};

export type AdminNotificationPreviewResult = {
  smsBody?: string;
  emailSubject?: string;
  emailPreviewText?: string;
  emailBodyPlain?: string;
  emailBodyHtml?: string;
  direction?: "rtl" | "ltr" | "auto";
  warnings: string[];
  invalidVariables: string[];
  segmentCountLabel?: string;
  characterCountLabel?: string;
};

export type AdminNotificationLogListItemView = {
  reference: string;
  sentAtLabel: string;
  eventType: AdminNotificationEventType;
  eventTypeLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  maskedRecipient: string;
  deliveryStatus: AdminNotificationDeliveryStatus;
  deliveryStatusLabel: string;
  templateReference?: string;
  templateVersionLabel?: string;
  relatedCustomerLabel?: string;
  relatedCustomerHref?: string;
  relatedAppointmentLabel?: string;
  relatedAppointmentHref?: string;
  branchName?: string;
  detailHref: string;
  canViewDetail: boolean;
  canRetry: boolean;
};

export type AdminNotificationLogListView = {
  items: AdminNotificationLogListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminNotificationTemplateListView["filterOptions"];
};

export type AdminNotificationLogTimelineEntry = {
  id: string;
  status: AdminNotificationDeliveryStatus;
  statusLabel: string;
  atLabel: string;
  detail?: string;
};

export type AdminNotificationLogDetailView = {
  reference: string;
  sentAtLabel: string;
  eventType: AdminNotificationEventType;
  eventTypeLabel: string;
  channel: NotificationChannel;
  channelLabel: string;
  maskedRecipient: string;
  deliveryStatus: AdminNotificationDeliveryStatus;
  deliveryStatusLabel: string;
  templateReference?: string;
  templateVersionLabel?: string;
  templateHref?: string;
  relatedCustomerLabel?: string;
  relatedCustomerHref?: string;
  relatedAppointmentLabel?: string;
  relatedAppointmentHref?: string;
  branchName?: string;
  errorCategory?: string;
  errorMessage?: string;
  timeline: AdminNotificationLogTimelineEntry[];
  allowedActions: {
    retry?: boolean;
    viewSensitive?: boolean;
    blockedReason?: string;
  };
  version?: string;
};
