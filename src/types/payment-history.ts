import type { StatusKey } from "@/lib/status/status-map";

/** Backend filter values for payment history list. */
export type PaymentHistoryStatusFilter =
  | "all"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "partially_refunded";

export type PaymentHistoryFilters = {
  status: PaymentHistoryStatusFilter;
  q?: string;
  appointmentId?: string;
  from?: string;
  to?: string;
  page: number;
};

export type PaymentHistoryItemView = {
  id: string;
  publicReference: string;
  status: StatusKey;
  statusHint?: string;
  amountLabel: string;
  currency?: string;
  paidAt?: string;
  createdAt?: string;
  timestampLabel?: string;
  transactionReference?: string;
  bookingReference?: string;
  appointmentId?: string;
  appointmentAvailable: boolean;
  serviceName?: string;
  appointmentWhenLabel?: string;
  methodLabel?: string;
  classificationLabel?: string;
  refundStatus?: StatusKey;
  refundAmountLabel?: string;
  refundReference?: string;
  receiptUrl?: string;
  receiptAvailable: boolean;
};

export type PaymentHistoryListView = {
  items: PaymentHistoryItemView[];
  page: number;
  pageCount?: number;
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
  /** True when Backend indicates the account has zero payments (not merely no filter matches). */
  emptyHistory: boolean;
  filtersApplied: boolean;
};

export type PaymentHistoryDetailView = PaymentHistoryItemView & {
  gatewayName?: string;
};

export const PAYMENT_HISTORY_LIST_LIMIT = 10;

export const PAYMENT_HISTORY_STATUS_FILTERS: PaymentHistoryStatusFilter[] = [
  "all",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "partially_refunded",
];

export const PAYMENT_HISTORY_STATUS_LABELS: Record<PaymentHistoryStatusFilter, string> = {
  all: "همه وضعیت‌ها",
  pending: "در انتظار",
  processing: "در حال پردازش",
  paid: "پرداخت‌شده",
  failed: "ناموفق",
  cancelled: "لغوشده",
  expired: "منقضی‌شده",
  refunded: "بازپرداخت‌شده",
  partially_refunded: "بازپرداخت جزئی",
};

export const PAYMENT_PENDING_STATUSES: StatusKey[] = ["pendingPayment", "processing"];

/** Detail route uses existing GET /customer/payments/{reference}. */
export const PAYMENT_HISTORY_DETAIL_ENABLED = true;
