import type { StatusKey } from "@/lib/status/status-map";
import type { AppApiError } from "@/types/api";

export type WidgetResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; error: AppApiError };

export type AppointmentPreview = {
  id: string;
  serviceName: string;
  providerName?: string;
  branchName?: string;
  startsAt: string;
  timezone?: string;
  durationMinutes?: number;
  status: StatusKey;
  paymentStatus?: StatusKey;
  reference?: string;
};

export type CustomerPendingAction = {
  type: string;
  title: string;
  description?: string;
  href: string;
  validUntil?: string;
};

export type PaymentSummaryView = {
  status?: StatusKey;
  amountLabel?: string;
  refundStatus?: StatusKey;
  continueHref?: string;
};

export type NotificationPreview = {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type ActivityPreview = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
};

export type CustomerDashboardView = {
  customer: {
    displayName: string;
  };
  nextAppointment: AppointmentPreview | null;
  upcomingAppointments: AppointmentPreview[];
  pendingAction: CustomerPendingAction | null;
  paymentSummary: PaymentSummaryView | null;
  unreadNotificationCount: number;
  recentNotifications: NotificationPreview[];
  recentActivities: ActivityPreview[] | null;
  bookingEnabled: boolean;
  widgets: {
    appointments?: WidgetResult<unknown>;
    payments?: WidgetResult<unknown>;
    notifications?: WidgetResult<unknown>;
  };
};
