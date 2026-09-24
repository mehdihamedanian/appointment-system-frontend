import type { StatusKey } from "@/lib/status/status-map";
import type { PaymentHistoryItemView, PaymentHistoryStatusFilter } from "@/types/payment-history";

export const ADMIN_PAYMENT_LIST_LIMIT = 20;

export const ADMIN_PAYMENT_REFUND_STATUS_FILTERS = [
  "all",
  "none",
  "pending",
  "refunded",
  "partially_refunded",
  "failed",
] as const;

export type AdminPaymentRefundStatusFilter =
  (typeof ADMIN_PAYMENT_REFUND_STATUS_FILTERS)[number];

export const ADMIN_PAYMENT_METHOD_FILTERS = [
  "all",
  "online",
  "cash",
  "card_terminal",
  "bank_transfer",
  "other",
] as const;

export type AdminPaymentMethodFilter = (typeof ADMIN_PAYMENT_METHOD_FILTERS)[number];

export const ADMIN_PAYMENT_SORT_FIELDS = ["createdAt", "paidAt", "amount", "reference"] as const;

export type AdminPaymentSortField = (typeof ADMIN_PAYMENT_SORT_FIELDS)[number];

export type AdminPaymentSortDirection = "asc" | "desc";

export type AdminPaymentListFilters = {
  q?: string;
  status: PaymentHistoryStatusFilter;
  refundStatus: AdminPaymentRefundStatusFilter;
  method: AdminPaymentMethodFilter;
  appointmentId?: string;
  customerId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  sort: AdminPaymentSortField;
  direction: AdminPaymentSortDirection;
  page: number;
};

export type AdminPaymentCustomerSummary = {
  reference: string;
  displayName: string;
  href: string;
  phoneMasked?: string;
  emailMasked?: string;
};

export type AdminPaymentAppointmentSummary = {
  reference: string;
  serviceName?: string;
  whenLabel?: string;
  href: string;
  status?: StatusKey;
};

export type AdminPaymentBranchSummary = {
  reference: string;
  name: string;
};

export type AdminPaymentListItemView = PaymentHistoryItemView & {
  detailHref: string;
  customer?: AdminPaymentCustomerSummary;
  appointment?: AdminPaymentAppointmentSummary;
  branch?: AdminPaymentBranchSummary;
  canViewDetail: boolean;
  canIssueRefund: boolean;
  canDownloadReceipt: boolean;
};

export type AdminPaymentListView = {
  items: AdminPaymentListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminPaymentFilterOptions;
  revenueSummaryAvailable: boolean;
};

export type AdminPaymentFilterOptions = {
  branches?: Array<{ id: string; name: string }>;
  methods?: Array<{ id: string; label: string }>;
};

export type AdminPaymentTimelineEntry = {
  id: string;
  label: string;
  timestampLabel?: string;
  timestamp?: string;
  status?: StatusKey;
  description?: string;
};

export type AdminPaymentInternalNoteView = {
  id: string;
  body: string;
  authorLabel?: string;
  createdAtLabel?: string;
};

export type AdminPaymentAllowedActions = {
  viewDetail?: boolean;
  viewPrivateFinancialData?: boolean;
  recordManualPayment?: boolean;
  issueRefund?: boolean;
  downloadReceipt?: boolean;
  copyReferences?: boolean;
};

export type AdminPaymentCapabilities = {
  supportsManualPayment?: boolean;
  supportsRefundPreview?: boolean;
  supportsPartialRefund?: boolean;
  supportsReceipt?: boolean;
  supportsRevenueSummary?: boolean;
  supportsInternalNotes?: boolean;
};

export type AdminPaymentDetailView = AdminPaymentListItemView & {
  updatedAt?: string;
  failedAt?: string;
  expiredAt?: string;
  remainingBalanceLabel?: string;
  failureMessage?: string;
  instrumentMasked?: string;
  gatewayName?: string;
  timeline: AdminPaymentTimelineEntry[];
  internalNotes: AdminPaymentInternalNoteView[];
  allowedActions: AdminPaymentAllowedActions;
  capabilities: AdminPaymentCapabilities;
  version?: string;
};

export type AdminPaymentRevenueSummaryView = {
  collectedLabel?: string;
  pendingLabel?: string;
  refundedLabel?: string;
  netRevenueLabel?: string;
  successfulCount?: number;
  periodLabel?: string;
  branchLabel?: string;
  methodBreakdown?: Array<{ methodLabel: string; amountLabel: string }>;
  state: "available" | "unavailable" | "error";
};

export type AdminPaymentRefundPreview = {
  title: string;
  summary?: string;
  maxRefundableLabel: string;
  currency?: string;
  allowsPartial: boolean;
  requiresReason: boolean;
  reasonOptions?: Array<{ id: string; label: string }>;
  policyLabel?: string;
  paymentVersion?: string;
};

export type AdminPaymentRefundInput = {
  amountLabel?: string;
  reason?: string;
  reasonCode?: string;
};

export type AdminPaymentRefundResult = {
  reference: string;
  refundStatus: StatusKey;
  refundAmountLabel?: string;
  refundReference?: string;
  message?: string;
  pending: boolean;
};

export type AdminManualPaymentOptionView = {
  type: string;
  title: string;
  description?: string;
  outstandingBalanceLabel?: string;
  minAmountLabel?: string;
  maxAmountLabel?: string;
  allowsCustomAmount: boolean;
  requiresReceiptReference: boolean;
  allowsInternalNote: boolean;
};

export type AdminManualPaymentOptionsView = {
  appointmentReference: string;
  outstandingBalanceLabel?: string;
  options: AdminManualPaymentOptionView[];
  state: "available" | "unavailable" | "error";
};

export type AdminManualPaymentInput = {
  appointmentReference: string;
  method: string;
  amountLabel?: string;
  receiptReference?: string;
  internalNote?: string;
};

export type AdminManualPaymentResult = {
  paymentReference: string;
  status: StatusKey;
  amountLabel: string;
  message?: string;
};

export const ADMIN_PAYMENT_REFUND_STATUS_LABELS: Record<AdminPaymentRefundStatusFilter, string> = {
  all: "همه بازپرداخت‌ها",
  none: "بدون بازپرداخت",
  pending: "بازپرداخت در انتظار",
  refunded: "بازپرداخت‌شده",
  partially_refunded: "بازپرداخت جزئی",
  failed: "بازپرداخت ناموفق",
};

export const ADMIN_PAYMENT_METHOD_LABELS: Record<AdminPaymentMethodFilter, string> = {
  all: "همه روش‌ها",
  online: "آنلاین",
  cash: "نقدی",
  card_terminal: "کارتخوان",
  bank_transfer: "انتقال بانکی",
  other: "سایر",
};

export const ADMIN_PAYMENT_SORT_LABELS: Record<AdminPaymentSortField, string> = {
  createdAt: "زمان ثبت",
  paidAt: "زمان پرداخت",
  amount: "مبلغ",
  reference: "کد پرداخت",
};
