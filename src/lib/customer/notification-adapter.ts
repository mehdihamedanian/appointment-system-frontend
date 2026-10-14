import {
  defaultNotificationActionLabel,
  resolveNotificationDeepLink,
} from "@/lib/customer/notification-deep-link";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, asSafeText, readBoolean, readNumber, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  CustomerNotificationDetailView,
  CustomerNotificationListView,
  CustomerNotificationType,
  CustomerNotificationView,
  NotificationReadFilter,
  NotificationUnreadCountView,
} from "@/types/customer-notification";

const TYPE_ALIASES: Record<string, CustomerNotificationType> = {
  booking_confirmation: "booking_confirmation",
  booking_confirmed: "booking_confirmation",
  confirmation: "booking_confirmation",
  appointment_reminder: "appointment_reminder",
  reminder: "appointment_reminder",
  reschedule: "reschedule",
  appointment_rescheduled: "reschedule",
  cancellation: "cancellation",
  appointment_cancelled: "cancellation",
  appointment_canceled: "cancellation",
  payment: "payment",
  payment_update: "payment",
  payment_success: "payment",
  payment_failed: "payment",
  refund: "refund",
  refund_update: "refund",
  waiting_list_offer: "waiting_list_offer",
  waiting_list: "waiting_list_offer",
  waitlist_offer: "waiting_list_offer",
  review_request: "review_request",
  review: "review_request",
  system: "system",
  general: "system",
  info: "system",
};

function notificationId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || raw.length > 80) {
    return undefined;
  }
  if (!isSafePublicId(raw)) {
    return undefined;
  }
  return raw;
}

export function parseNotificationType(value: unknown): CustomerNotificationType {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return "unknown";
  }
  return TYPE_ALIASES[raw] ?? "unknown";
}

export function adaptCustomerNotification(value: unknown): CustomerNotificationView | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id =
    notificationId(value.id) ??
    notificationId(value.notificationId) ??
    notificationId(value.publicId) ??
    notificationId(value.reference);
  const title = asSafeText(value.title) ?? asSafeText(value.subject);
  const createdAt =
    readString(value.createdAt) ??
    readString(value.created_at) ??
    readString(value.sentAt) ??
    readString(value.occurredAt);
  if (!id || !title || !createdAt) {
    return null;
  }

  const entityType =
    readString(value.entityType) ??
    readString(value.relatedType) ??
    readString(isRecord(value.entity) ? value.entity.type : undefined);
  const entityReference =
    notificationId(value.entityReference) ??
    notificationId(value.relatedReference) ??
    notificationId(value.relatedId) ??
    notificationId(isRecord(value.entity) ? value.entity.reference ?? value.entity.id : undefined);

  const href = resolveNotificationDeepLink({
    entityType,
    entityReference,
    actionType: readString(value.actionType) ?? readString(value.action),
    href: readString(value.href) ?? readString(value.deepLink) ?? readString(value.url),
  });

  const view: CustomerNotificationView = {
    id,
    type: parseNotificationType(
      value.type ?? value.notification_type ?? value.category ?? value.kind,
    ),
    title,
    createdAt,
    read:
      readBoolean(value.read) ??
      readBoolean(value.isRead) ??
      Boolean(readString(value.readAt) ?? readString(value.read_at)),
  };

  const message = asSafeText(value.message) ?? asSafeText(value.body) ?? asSafeText(value.summary);
  if (message) view.message = message;
  const readAt = readString(value.readAt) ?? readString(value.read_at);
  if (readAt) view.readAt = readAt;
  if (entityType) view.entityType = entityType;
  if (entityReference) view.entityReference = entityReference;
  if (href) {
    view.href = href;
    const actionLabel =
      asSafeText(value.actionLabel) ??
      asSafeText(value.ctaLabel) ??
      defaultNotificationActionLabel(entityType, href);
    if (actionLabel) view.actionLabel = actionLabel;
  }
  return view;
}

export function adaptCustomerNotificationList(
  payload: unknown,
  input: { page: number; readFilter: NotificationReadFilter },
): CustomerNotificationListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "notifications", "results"])
    .map((item) => adaptCustomerNotification(item))
    .filter((item): item is CustomerNotificationView => Boolean(item));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const page = readNumber(source.page) ?? input.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const unreadCount =
    readNumber(source.unreadCount) ??
    readNumber(source.unread_count) ??
    readNumber(source.unreadNotificationCount);
  const nextCursor = readString(source.nextCursor) ?? readString(source.cursor);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    Boolean(nextCursor) ||
    (typeof pageCount === "number" && pageCount > page);
  const filtersApplied = input.readFilter !== "all";
  const emptyFlag = readBoolean(source.emptyInbox) ?? readBoolean(source.isEmpty);
  const emptyInbox =
    emptyFlag === true ||
    (!filtersApplied && unique.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: CustomerNotificationListView = {
    items: unique,
    page: typeof page === "number" && page > 0 ? page : input.page,
    hasMore,
    emptyInbox,
    filtersApplied,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (nextCursor) view.nextCursor = nextCursor;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;
  if (typeof unreadCount === "number" && unreadCount >= 0) view.unreadCount = unreadCount;
  return view;
}

export function adaptCustomerNotificationDetail(
  payload: unknown,
): CustomerNotificationDetailView | null {
  const root = unwrapPayload(payload);
  const base = adaptCustomerNotification(root);
  if (!base) {
    return null;
  }
  const detail: CustomerNotificationDetailView = { ...base };
  if (isRecord(root)) {
    const detailMessage =
      asSafeText(root.detail) ??
      asSafeText(root.detailMessage) ??
      asSafeText(root.fullMessage);
    if (detailMessage && detailMessage !== base.message) {
      detail.detailMessage = detailMessage;
    }
  }
  return detail;
}

export function adaptUnreadCount(payload: unknown): NotificationUnreadCountView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const unreadCount =
    readNumber(source.unreadCount) ??
    readNumber(source.unread_count) ??
    readNumber(source.count) ??
    readNumber(source.unreadNotificationCount) ??
    0;
  return {
    unreadCount: typeof unreadCount === "number" && unreadCount > 0 ? Math.floor(unreadCount) : 0,
  };
}

export function adaptRecentNotifications(
  payload: unknown,
  limit = 5,
): CustomerNotificationView[] {
  const root = unwrapPayload(payload);
  const list = isRecord(root)
    ? asList(root, ["items", "notifications", "recent", "results"])
    : asList(root, ["items"]);
  return list
    .map((item) => adaptCustomerNotification(item))
    .filter((item): item is CustomerNotificationView => Boolean(item))
    .slice(0, limit);
}

export function clampUnreadBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "۹۹+";
  return new Intl.NumberFormat("fa-IR").format(count);
}
