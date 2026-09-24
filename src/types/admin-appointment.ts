import type { StatusKey } from "@/lib/status/status-map";
import type { PaymentSummaryView, PolicySnapshot } from "@/types/appointment-detail";
import type {
  AppointmentBranchSnapshot,
  AppointmentProviderSnapshot,
  AppointmentServiceSnapshot,
} from "@/types/appointment-list";
import type { CustomerTimelineEvent } from "@/types/appointment-detail";
import type {
  CancellationPreviewView,
  CancellationResultView,
} from "@/types/appointment-cancellation";

export type AdminAppointmentActionKey =
  | "confirm"
  | "checkIn"
  | "start"
  | "complete"
  | "markNoShow"
  | "cancel"
  | "reschedule"
  | "editInternalNote";

export type AdminAppointmentAllowedActions = Partial<
  Record<AdminAppointmentActionKey, boolean>
> & {
  processing?: boolean;
  blockedReason?: string;
};

export type AdminAppointmentSortField =
  | "startsAt"
  | "reference"
  | "status"
  | "customerName"
  | "createdAt";

export type AdminAppointmentSortDirection = "asc" | "desc";

export type AdminAppointmentListFilters = {
  q?: string;
  date?: string;
  from?: string;
  to?: string;
  status: string;
  paymentStatus: string;
  serviceId?: string;
  staffId?: string;
  resourceId?: string;
  customerId?: string;
  branchId?: string;
  bookingSource?: string;
  sort: AdminAppointmentSortField;
  direction: AdminAppointmentSortDirection;
  page: number;
};

export type AdminAppointmentListItem = {
  id: string;
  reference: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  durationMinutes?: number;
  customerName: string;
  service: AppointmentServiceSnapshot;
  provider?: AppointmentProviderSnapshot;
  resourceName?: string;
  branch?: AppointmentBranchSnapshot;
  status: StatusKey;
  paymentStatus?: StatusKey;
  bookingSource?: string;
  allowedActions: AdminAppointmentAllowedActions;
};

export type AdminAppointmentListView = {
  items: AdminAppointmentListItem[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  nextCursor?: string;
  filtersApplied: boolean;
  emptyHistory: boolean;
  filterOptions?: AdminAppointmentFilterOptions;
};

export type AdminAppointmentFilterOptions = {
  services?: Array<{ id: string; name: string }>;
  staff?: Array<{ id: string; name: string }>;
  resources?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
  bookingSources?: Array<{ value: string; label: string }>;
};

export type AdminCustomerSnapshot = {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  contactMasked?: boolean;
  profileHref?: string;
};

export type AdminResourceSnapshot = {
  id: string;
  name: string;
  type?: string;
};

export type AdminAppointmentDetailView = {
  id: string;
  reference: string;
  status: StatusKey;
  service: AppointmentServiceSnapshot & { durationMinutes?: number; description?: string };
  provider?: AppointmentProviderSnapshot;
  branch?: AppointmentBranchSnapshot;
  startsAt: string;
  endsAt?: string;
  durationMinutes?: number;
  timezone?: string;
  bookingSource?: string;
  customer: AdminCustomerSnapshot;
  payment: PaymentSummaryView & { paymentHref?: string };
  resources?: AdminResourceSnapshot[];
  customerNote?: string;
  internalNote?: string;
  timeline?: CustomerTimelineEvent[];
  allowedActions: AdminAppointmentAllowedActions;
  version?: string;
  updatedAt?: string;
};

export type AdminAppointmentMutationResult = {
  reference: string;
  status: StatusKey;
  message?: string;
  version?: string;
  updatedAt?: string;
};

export type AdminNoShowReasonOption = {
  code: string;
  label: string;
  requiresText?: boolean;
};

export type AdminCancellationPreviewView = CancellationPreviewView;
export type AdminCancellationResultView = CancellationResultView;

export const ADMIN_APPOINTMENT_LIST_LIMIT = 20;

export const ADMIN_APPOINTMENT_SORT_FIELDS: AdminAppointmentSortField[] = [
  "startsAt",
  "reference",
  "status",
  "customerName",
  "createdAt",
];

export const ADMIN_APPOINTMENT_STATUS_FILTERS = [
  "all",
  "pending",
  "scheduled",
  "confirmed",
  "checkedIn",
  "inProgress",
  "completed",
  "cancelled",
  "noShow",
] as const;

export type AdminAppointmentStatusFilter =
  (typeof ADMIN_APPOINTMENT_STATUS_FILTERS)[number];

export const ADMIN_PAYMENT_STATUS_FILTERS = [
  "all",
  "unpaid",
  "pendingPayment",
  "paid",
  "depositPaid",
  "failed",
  "refunded",
  "partiallyRefunded",
] as const;

export type AdminPaymentStatusFilter = (typeof ADMIN_PAYMENT_STATUS_FILTERS)[number];

export const ADMIN_APPOINTMENT_RESCHEDULE_ENABLED = false;

export const ADMIN_INTERNAL_NOTE_MAX_LENGTH = 2000;

export const ADMIN_APPOINTMENT_STATUS_LABELS: Record<AdminAppointmentStatusFilter, string> = {
  all: "همه وضعیت‌ها",
  pending: "در انتظار تأیید",
  scheduled: "زمان‌بندی‌شده",
  confirmed: "تأییدشده",
  checkedIn: "ورود ثبت شد",
  inProgress: "در حال انجام",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  noShow: "حاضر نشد",
};

export const ADMIN_PAYMENT_STATUS_LABELS: Record<AdminPaymentStatusFilter, string> = {
  all: "همه پرداخت‌ها",
  unpaid: "پرداخت‌نشده",
  pendingPayment: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  depositPaid: "بیعانه پرداخت شده",
  failed: "ناموفق",
  refunded: "بازپرداخت‌شده",
  partiallyRefunded: "بازپرداخت جزئی",
};

export const ADMIN_SORT_LABELS: Record<AdminAppointmentSortField, string> = {
  startsAt: "زمان نوبت",
  reference: "کد رزرو",
  status: "وضعیت",
  customerName: "مشتری",
  createdAt: "زمان ثبت",
};
