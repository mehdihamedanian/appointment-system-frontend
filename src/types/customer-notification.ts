import type { StatusKey } from "@/lib/status/status-map";

export type CustomerNotificationType =
  | "booking_confirmation"
  | "appointment_reminder"
  | "reschedule"
  | "cancellation"
  | "payment"
  | "refund"
  | "waiting_list_offer"
  | "review_request"
  | "system"
  | "unknown";

export type NotificationReadFilter = "all" | "unread" | "read";

export type CustomerNotificationView = {
  id: string;
  type: CustomerNotificationType;
  title: string;
  message?: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  entityType?: string;
  entityReference?: string;
  href?: string;
  actionLabel?: string;
};

export type CustomerNotificationListView = {
  items: CustomerNotificationView[];
  page: number;
  pageCount?: number;
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
  unreadCount?: number;
  emptyInbox: boolean;
  filtersApplied: boolean;
};

export type CustomerNotificationDetailView = CustomerNotificationView & {
  /** Longer body when Backend returns detail beyond the list message. */
  detailMessage?: string;
};

export type NotificationUnreadCountView = {
  unreadCount: number;
};

export const NOTIFICATION_LIST_LIMIT = 20;
export const NOTIFICATION_RECENT_LIMIT = 5;
export const NOTIFICATION_DETAIL_ENABLED = true;

export const NOTIFICATION_READ_FILTERS: NotificationReadFilter[] = ["all", "unread", "read"];

export const NOTIFICATION_READ_FILTER_LABELS: Record<NotificationReadFilter, string> = {
  all: "همه",
  unread: "خوانده‌نشده",
  read: "خوانده‌شده",
};

export const NOTIFICATION_TYPE_LABELS: Record<CustomerNotificationType, string> = {
  booking_confirmation: "تأیید رزرو",
  appointment_reminder: "یادآوری نوبت",
  reschedule: "تغییر زمان",
  cancellation: "لغو نوبت",
  payment: "پرداخت",
  refund: "بازپرداخت",
  waiting_list_offer: "لیست انتظار",
  review_request: "نظرسنجی",
  system: "سیستم",
  unknown: "اعلان",
};

/** Optional StatusKey hint when a notification mirrors a known payment/appointment state. */
export type NotificationStatusHint = StatusKey;
