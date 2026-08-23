import { formatAppointmentParts, formatCurrencyAmount } from "@/lib/date-time/format";
import { paymentHistoryFiltersApplied } from "@/lib/customer/payment-history-filters";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, asSafeText, readBoolean, readNumber, readUrl, unwrapPayload } from "@/lib/public/read";
import { parseStatusKey, type StatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type { PaymentHistoryFilters } from "@/types/payment-history";
import type {
  PaymentHistoryDetailView,
  PaymentHistoryItemView,
  PaymentHistoryListView,
} from "@/types/payment-history";

const STATUS_HINTS: Partial<Record<StatusKey, string>> = {
  pendingPayment: "وضعیت پرداخت هنوز نهایی نشده است. می‌توانید وضعیت را به‌روز کنید.",
  processing: "پرداخت در حال پردازش است. نتیجه از سرویس پرداخت اعلام می‌شود.",
  failed: "پرداخت ناموفق بود. در صورت امکان از مسیر رزرو دوباره تلاش کنید.",
  expired: "مهلت این پرداخت به پایان رسیده است.",
  cancelled: "این پرداخت لغو شده است.",
  refunded: "مبلغ طبق اعلام سرویس بازپرداخت شده است.",
  partiallyRefunded: "بخشی از مبلغ طبق اعلام سرویس بازپرداخت شده است.",
};

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function moneyLabel(value: unknown, currency?: string, allowZero = false): string | undefined {
  if (typeof value === "string") {
    return asSafeText(value);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    if (!allowZero && value === 0) {
      return undefined;
    }
    return formatCurrencyAmount(value, currency);
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const labeled =
    asSafeText(value.label) ?? asSafeText(value.formatted) ?? asSafeText(value.amountLabel);
  if (labeled) {
    return labeled;
  }
  if (typeof value.amount === "number" && Number.isInteger(value.amount)) {
    if (!allowZero && value.amount === 0) {
      return undefined;
    }
    return formatCurrencyAmount(value.amount, readString(value.currency) ?? currency);
  }
  return undefined;
}

function safeReceiptUrl(value: unknown): string | undefined {
  const url = readUrl(value);
  if (!url) {
    return undefined;
  }
  if (url.startsWith("/")) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.hostname === "localhost") {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parsePaymentStatus(value: unknown): StatusKey {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return "unknown";
  }
  // Payment "pending" must not reuse appointment confirmation "pending".
  if (
    raw === "pending" ||
    raw === "created" ||
    raw === "redirect_required" ||
    raw === "redirect" ||
    raw === "pending_payment" ||
    raw === "payment_pending"
  ) {
    return "pendingPayment";
  }
  if (raw === "processing") {
    return "processing";
  }
  if (raw === "success") {
    return "paid";
  }
  const key = parseStatusKey(value);
  if (key === "pending") {
    return "pendingPayment";
  }
  if (key) {
    return key;
  }
  // Never treat unrecognized values as paid.
  return "unknown";
}

function classificationLabel(value: unknown): string | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "deposit" || raw === "pay_deposit") {
    return "بیعانه";
  }
  if (raw === "full" || raw === "pay_full" || raw === "online") {
    return "پرداخت کامل";
  }
  if (raw === "pay_at_location" || raw === "pay_later") {
    return "پرداخت در محل";
  }
  return asSafeText(value);
}

function timestampLabel(iso: string | undefined, timeZone?: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  return formatAppointmentParts(iso, timeZone)?.label;
}

export function adaptPaymentHistoryItem(value: unknown): PaymentHistoryItemView | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id =
    publicId(value.publicReference) ??
    publicId(value.paymentReference) ??
    publicId(value.reference) ??
    publicId(value.paymentId) ??
    publicId(value.id);
  if (!id) {
    return null;
  }
  const currency =
    readString(value.currency) ??
    (isRecord(value.amount) ? readString(value.amount.currency) : undefined);
  const amountLabel =
    moneyLabel(value.amountLabel ?? value.payableNowLabel ?? value.amount ?? value.total, currency, true) ??
    moneyLabel(isRecord(value.pricing) ? value.pricing.payableNow : undefined, currency, true);
  if (!amountLabel) {
    return null;
  }
  const status = parsePaymentStatus(value.status ?? value.paymentStatus ?? value.result);
  const paidAt = readString(value.paidAt) ?? readString(value.completedAt);
  const createdAt = readString(value.createdAt) ?? readString(value.initiatedAt);
  const timeZone = readString(value.timezone) ?? readString(value.timeZone);
  const appointmentId =
    publicId(value.appointmentId) ??
    publicId(value.appointmentReference) ??
    (isRecord(value.appointment) ? publicId(value.appointment.id) ?? publicId(value.appointment.reference) : undefined);
  const bookingReference =
    publicId(value.bookingReference) ??
    publicId(value.bookingId) ??
    appointmentId;
  const appointmentAvailable =
    readBoolean(value.appointmentAvailable) ??
    readBoolean(isRecord(value.appointment) ? value.appointment.available : undefined) ??
    Boolean(appointmentId);
  const receiptUrl =
    safeReceiptUrl(value.receiptUrl) ??
    safeReceiptUrl(value.receiptLink) ??
    safeReceiptUrl(isRecord(value.receipt) ? value.receipt.url : undefined);
  const receiptAvailable =
    Boolean(receiptUrl) ||
    readBoolean(value.receiptAvailable) === true ||
    readBoolean(isRecord(value.receipt) ? value.receipt.available : undefined) === true;

  const item: PaymentHistoryItemView = {
    id,
    publicReference: publicId(value.publicReference) ?? publicId(value.paymentReference) ?? id,
    status,
    amountLabel,
    appointmentAvailable: appointmentAvailable && Boolean(appointmentId),
    receiptAvailable,
  };
  if (STATUS_HINTS[status]) item.statusHint = STATUS_HINTS[status];
  if (currency) item.currency = currency;
  if (paidAt) item.paidAt = paidAt;
  if (createdAt) item.createdAt = createdAt;
  const when = timestampLabel(paidAt ?? createdAt, timeZone);
  if (when) item.timestampLabel = when;
  const transactionReference =
    publicId(value.transactionReference) ??
    publicId(isRecord(value.transaction) ? value.transaction.reference : undefined);
  if (transactionReference) item.transactionReference = transactionReference;
  if (bookingReference) item.bookingReference = bookingReference;
  if (appointmentId) item.appointmentId = appointmentId;
  const serviceName =
    asSafeText(value.serviceName) ??
    (isRecord(value.service) ? asSafeText(value.service.name) ?? asSafeText(value.service.title) : undefined);
  if (serviceName) item.serviceName = serviceName;
  const appointmentStartsAt =
    readString(value.appointmentStartsAt) ??
    (isRecord(value.appointment) ? readString(value.appointment.startsAt) : undefined);
  const appointmentWhen = timestampLabel(appointmentStartsAt, timeZone);
  if (appointmentWhen) item.appointmentWhenLabel = appointmentWhen;
  const methodLabel =
    asSafeText(value.methodLabel) ??
    asSafeText(value.paymentMethodLabel) ??
    classificationLabel(value.method ?? value.paymentMethod);
  if (methodLabel) item.methodLabel = methodLabel;
  const classification = classificationLabel(value.classification ?? value.paymentType ?? value.method);
  if (classification) item.classificationLabel = classification;
  const refundStatus =
    parseStatusKey(value.refundStatus) ??
    parseStatusKey(isRecord(value.refund) ? value.refund.status : undefined);
  if (refundStatus && refundStatus !== "unknown") item.refundStatus = refundStatus;
  const refundAmountLabel = moneyLabel(
    value.refundAmountLabel ??
      value.refundedAmountLabel ??
      (isRecord(value.refund) ? value.refund.amountLabel ?? value.refund.amount : undefined),
    currency,
    true,
  );
  if (refundAmountLabel) item.refundAmountLabel = refundAmountLabel;
  const refundReference =
    publicId(value.refundReference) ??
    (isRecord(value.refund) ? publicId(value.refund.reference) : undefined);
  if (refundReference) item.refundReference = refundReference;
  if (receiptUrl) item.receiptUrl = receiptUrl;
  return item;
}

export function adaptPaymentHistoryList(
  payload: unknown,
  filters: PaymentHistoryFilters,
): PaymentHistoryListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const list = asList(root, ["items", "payments", "results"]);
  const items = list
    .map((item) => adaptPaymentHistoryItem(item))
    .filter((item): item is PaymentHistoryItemView => Boolean(item));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const nextCursor = readString(source.nextCursor) ?? readString(source.cursor);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    Boolean(nextCursor) ||
    (typeof pageCount === "number" && pageCount > page);
  const filtersOn = paymentHistoryFiltersApplied(filters);
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && unique.length === 0 && (totalCount === 0 || totalCount === undefined));

  const view: PaymentHistoryListView = {
    items: unique,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore,
    emptyHistory,
    filtersApplied: filtersOn,
  };
  if (typeof pageCount === "number" && pageCount > 0) view.pageCount = pageCount;
  if (nextCursor) view.nextCursor = nextCursor;
  if (typeof totalCount === "number" && totalCount >= 0) view.totalCount = totalCount;
  return view;
}

export function adaptPaymentHistoryDetail(payload: unknown): PaymentHistoryDetailView | null {
  const root = unwrapPayload(payload);
  const item = adaptPaymentHistoryItem(root);
  if (!item) {
    return null;
  }
  const detail: PaymentHistoryDetailView = { ...item };
  if (isRecord(root)) {
    const gatewayName = asSafeText(root.gatewayName) ?? asSafeText(root.gateway);
    if (gatewayName) detail.gatewayName = gatewayName;
  }
  return detail;
}

export function adaptPaymentReceiptUrl(payload: unknown): string | undefined {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return safeReceiptUrl(payload);
  }
  return (
    safeReceiptUrl(root.url) ??
    safeReceiptUrl(root.receiptUrl) ??
    safeReceiptUrl(root.downloadUrl) ??
    safeReceiptUrl(root.href)
  );
}
