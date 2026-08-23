import { getSafeCustomerDeepLink } from "@/lib/customer/deep-link";
import { adaptCustomerNotification } from "@/lib/customer/notification-adapter";
import { formatCurrencyAmount, isTimestampExpired } from "@/lib/date-time/format";
import { parseStatusKey } from "@/lib/status/status-map";
import type { StatusKey } from "@/lib/status/status-map";
import type { AppApiError } from "@/types/api";
import type {
  ActivityPreview,
  AppointmentPreview,
  CustomerDashboardView,
  CustomerPendingAction,
  NotificationPreview,
  PaymentSummaryView,
  WidgetResult,
} from "@/types/customer";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";

export const UPCOMING_PREVIEW_LIMIT = 3;
export const NOTIFICATION_PREVIEW_LIMIT = 3;

const ALLOWED_ACTIVITY_TYPES = new Set([
  "appointment_created",
  "payment_recorded",
  "appointment_cancelled",
  "appointment_rescheduled",
  "refund_initiated",
  "refund_completed",
]);

function readStatus(value: unknown): StatusKey | undefined {
  return parseStatusKey(value);
}

function readId(source: Record<string, unknown>): string | undefined {
  const id =
    readString(source.id) ??
    readString(source.appointmentId) ??
    readString(source.publicId) ??
    readString(source.reference);
  return isSafePublicId(id) ? id : undefined;
}

function widgetError(value: unknown): AppApiError | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = isRecord(value.error) ? value.error : value;
  const status = typeof nested.status === "number" ? nested.status : undefined;
  const message = readString(nested.message);
  if (status && status >= 400) {
    return {
      status,
      code: readString(nested.code),
      message: message ?? "دریافت این بخش ممکن نشد.",
      requestId: readString(nested.requestId),
    };
  }
  if (readBoolean(value.failed) === true || readString(value.error)) {
    return {
      status: 500,
      message: message ?? readString(value.error) ?? "دریافت این بخش ممکن نشد.",
      requestId: readString(nested.requestId),
    };
  }
  return undefined;
}

export function adaptAppointmentPreview(value: unknown): AppointmentPreview | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readId(value);
  const serviceName =
    readString(value.serviceName) ??
    (isRecord(value.service) ? readString(value.service.name) : undefined);
  const startsAt =
    readString(value.startsAt) ??
    readString(value.startAt) ??
    readString(value.scheduledAt) ??
    readString(value.startTime);
  const status = readStatus(value.status) ?? readStatus(value.appointmentStatus);
  if (!id || !serviceName || !startsAt || !status) {
    return null;
  }

  const providerName =
    readString(value.providerName) ??
    (isRecord(value.provider) ? readString(value.provider.publicName) ?? readString(value.provider.name) : undefined) ??
    (isRecord(value.staff) ? readString(value.staff.publicName) : undefined);

  return {
    id,
    serviceName,
    providerName,
    branchName:
      readString(value.branchName) ??
      (isRecord(value.branch) ? readString(value.branch.name) : undefined),
    startsAt,
    timezone: readString(value.timezone) ?? readString(value.timeZone),
    durationMinutes: readNumber(value.durationMinutes) ?? readNumber(value.duration),
    status,
    paymentStatus: readStatus(value.paymentStatus),
    reference: readString(value.reference) ?? readString(value.bookingReference),
  };
}

function adaptAppointments(value: unknown): AppointmentPreview[] {
  return asList(value, ["items", "appointments", "upcoming", "results"])
    .map(adaptAppointmentPreview)
    .filter((item): item is AppointmentPreview => Boolean(item))
    .slice(0, UPCOMING_PREVIEW_LIMIT);
}

function adaptPendingAction(value: unknown, now: Date): CustomerPendingAction | null {
  if (!isRecord(value)) {
    return null;
  }
  const type =
    readString(value.type) ??
    readString(value.actionType) ??
    readString(value.kind);
  const title = asSafeText(value.title) ?? asSafeText(value.label);
  const href = getSafeCustomerDeepLink(
    readString(value.href) ?? readString(value.url) ?? readString(value.deepLink),
  );
  const validUntil = readString(value.validUntil) ?? readString(value.expiresAt);
  if (!type || !title || !href) {
    return null;
  }
  if (readBoolean(value.valid) === false) {
    return null;
  }
  if (isTimestampExpired(validUntil, now)) {
    return null;
  }
  return {
    type,
    title,
    description: asSafeText(value.description),
    href,
    validUntil,
  };
}

function adaptPaymentSummary(value: unknown, now: Date): PaymentSummaryView | null {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return null;
  }
  const amountLabel =
    readString(value.amountLabel) ??
    readString(value.formattedAmount) ??
    (typeof readNumber(value.amount) === "number"
      ? formatCurrencyAmount(readNumber(value.amount) as number, readString(value.currency))
      : undefined);
  const continueHref = isTimestampExpired(
    readString(value.validUntil) ?? readString(value.expiresAt),
    now,
  )
    ? undefined
    : getSafeCustomerDeepLink(readString(value.continueHref) ?? readString(value.href));

  const summary: PaymentSummaryView = {
    status: readStatus(value.status) ?? readStatus(value.paymentStatus),
    amountLabel,
    refundStatus: readStatus(value.refundStatus),
    continueHref,
  };
  if (!summary.status && !summary.amountLabel && !summary.refundStatus && !summary.continueHref) {
    return null;
  }
  return summary;
}

function adaptNotification(item: unknown): NotificationPreview | null {
  const adapted = adaptCustomerNotification(item);
  if (!adapted) {
    return null;
  }
  const preview: NotificationPreview = {
    id: adapted.id,
    title: adapted.title,
    createdAt: adapted.createdAt,
    read: adapted.read,
  };
  if (adapted.message) {
    preview.body = adapted.message;
  }
  if (adapted.href) {
    preview.href = adapted.href;
  }
  return preview;
}

function adaptNotifications(value: unknown): NotificationPreview[] {
  return asList(value, ["items", "notifications", "results"])
    .map(adaptNotification)
    .filter((item): item is NotificationPreview => Boolean(item))
    .slice(0, NOTIFICATION_PREVIEW_LIMIT);
}

function adaptActivities(value: unknown): ActivityPreview[] | null {
  if (value == null) {
    return null;
  }
  const items = asList(value, ["items", "activities", "results"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const type = (readString(item.type) ?? readString(item.eventType) ?? "").toLowerCase();
      if (!ALLOWED_ACTIVITY_TYPES.has(type)) {
        return null;
      }
      const id = readString(item.id);
      const title = asSafeText(item.title) ?? asSafeText(item.label);
      const createdAt = readString(item.createdAt) ?? readString(item.occurredAt);
      if (!id || !title || !createdAt) {
        return null;
      }
      return { id, type, title, createdAt } satisfies ActivityPreview;
    })
    .filter((item): item is ActivityPreview => Boolean(item));
  return items;
}

function readWidget(value: unknown): WidgetResult<unknown> | undefined {
  const error = widgetError(value);
  if (error) {
    return { status: "error", error };
  }
  return undefined;
}

export function adaptCustomerDashboard(
  payload: unknown,
  now: Date = new Date(),
): CustomerDashboardView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const customerSource = isRecord(source.customer)
    ? source.customer
    : isRecord(source.user)
      ? source.user
      : source;

  const upcoming = adaptAppointments(
    source.upcomingAppointments ?? source.upcoming ?? source.appointments,
  );
  const designated = adaptAppointmentPreview(
    source.nextAppointment ?? source.nearestAppointment,
  );

  return {
    customer: {
      displayName:
        readString(customerSource.displayName) ??
        readString(customerSource.fullName) ??
        readString(customerSource.name) ??
        "مشتری",
    },
    nextAppointment: designated ?? upcoming[0] ?? null,
    upcomingAppointments: upcoming,
    pendingAction: adaptPendingAction(source.pendingAction ?? source.action, now),
    paymentSummary: adaptPaymentSummary(source.paymentSummary ?? source.payment, now),
    unreadNotificationCount:
      readNumber(source.unreadNotificationCount) ??
      readNumber(isRecord(source.notifications) ? source.notifications.unreadCount : undefined) ??
      0,
    recentNotifications: adaptNotifications(
      source.recentNotifications ?? source.notifications,
    ),
    recentActivities: adaptActivities(source.recentActivities ?? source.activity),
    bookingEnabled: readBoolean(source.bookingEnabled) ?? true,
    widgets: {
      appointments: readWidget(source.upcomingAppointments ?? source.appointments),
      payments: readWidget(source.paymentSummary ?? source.payment),
      notifications: readWidget(source.notifications ?? source.recentNotifications),
    },
  };
}

export function hasNoUpcomingAppointments(view: CustomerDashboardView): boolean {
  return (
    view.widgets.appointments?.status !== "error" &&
    !view.nextAppointment &&
    view.upcomingAppointments.length === 0
  );
}
