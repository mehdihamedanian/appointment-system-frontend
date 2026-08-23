import type { StatusKey } from "@/lib/status/status-map";

export type AppointmentCategory = "upcoming" | "past" | "cancelled";

export type AppointmentProviderMode =
  | "specific"
  | "assigned"
  | "pending_assignment"
  | "not_applicable";

export type AppointmentServiceSnapshot = {
  id?: string;
  name: string;
};

export type AppointmentProviderSnapshot = {
  mode: AppointmentProviderMode;
  id?: string;
  name?: string;
  title?: string;
};

export type AppointmentBranchSnapshot = {
  id?: string;
  name: string;
};

export type AppointmentActionsView = {
  canView: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  canRepeat: boolean;
  canPay: boolean;
  canReview: boolean;
  processing?: boolean;
  payHref?: string;
  payValidUntil?: string;
  blockedReason?: string;
};

export type AppointmentListItemView = {
  id: string;
  publicReference: string;
  status: StatusKey;
  service: AppointmentServiceSnapshot;
  provider?: AppointmentProviderSnapshot;
  branch?: AppointmentBranchSnapshot;
  startsAt: string;
  endsAt?: string;
  durationMinutes?: number;
  timezone?: string;
  paymentStatus?: StatusKey;
  actions: AppointmentActionsView;
};

export type AppointmentListCounts = {
  upcoming?: number;
  past?: number;
  cancelled?: number;
};

export type AppointmentListView = {
  category: AppointmentCategory;
  items: AppointmentListItemView[];
  page: number;
  pageCount?: number;
  hasMore: boolean;
  nextCursor?: string;
  counts?: AppointmentListCounts;
};

export const APPOINTMENT_CATEGORIES: AppointmentCategory[] = [
  "upcoming",
  "past",
  "cancelled",
];

export const APPOINTMENT_LIST_LIMIT = 10;

/** Phase 15 detail route exists as `/appointments/[id]`. */
export const APPOINTMENT_DETAIL_ENABLED = true;
/** Cancellation UI belongs to Phase 16 at `/appointments/[id]/cancel`. */
export const APPOINTMENT_CANCEL_ENABLED = true;
/** Reschedule mutation belongs to Phase 17. */
export const APPOINTMENT_RESCHEDULE_ENABLED = true;
/** Review UI belongs to Phase 22 at `/appointments/[id]/review`. */
export const APPOINTMENT_REVIEW_ENABLED = true;

export const CATEGORY_LABELS: Record<AppointmentCategory, string> = {
  upcoming: "آینده",
  past: "گذشته",
  cancelled: "لغوشده",
};

export const CATEGORY_EMPTY: Record<AppointmentCategory, string> = {
  upcoming: "نوبت آینده‌ای ندارید.",
  past: "هنوز نوبت تکمیل‌شده‌ای ندارید.",
  cancelled: "نوبت لغوشده‌ای وجود ندارد.",
};
