import { formatCurrencyAmount } from "@/lib/date-time/format";
import { appointmentProviderLabel } from "@/lib/customer/appointment-detail-adapter";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import { parseStatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type { PolicySnapshot } from "@/types/appointment-detail";
import type {
  CancellationAppointmentSnapshot,
  CancellationPreviewView,
  CancellationReasonOption,
  CancellationRefundStatus,
  CancellationRefundView,
  CancellationResultView,
} from "@/types/appointment-cancellation";
import { DEFAULT_CANCELLATION_REASON_MAX_LENGTH } from "@/types/appointment-cancellation";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";

export { appointmentProviderLabel };

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function moneyLabel(value: unknown, currency?: string): string | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
    return formatCurrencyAmount(value, currency);
  }
  if (typeof value === "string") {
    return asSafeText(value);
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const labeled =
    asSafeText(value.label) ?? asSafeText(value.formatted) ?? asSafeText(value.amountLabel);
  if (labeled) {
    return labeled;
  }
  if (typeof value.amount === "number" && Number.isInteger(value.amount) && value.amount !== 0) {
    return formatCurrencyAmount(value.amount, readString(value.currency) ?? currency);
  }
  return undefined;
}

function adaptRefundStatus(value: unknown): CancellationRefundStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return "none";
  }
  if (raw === "full" || raw === "full_refund") return "full";
  if (raw === "partial" || raw === "partial_refund") return "partial";
  if (raw === "pending_calculation" || raw === "pending" || raw === "calculating") {
    return "pending_calculation";
  }
  if (raw === "already_refunded" || raw === "refunded") return "already_refunded";
  if (raw === "processing" || raw === "in_progress") return "processing";
  return "none";
}

function adaptRefund(root: Record<string, unknown>): CancellationRefundView {
  const source = isRecord(root.refund) && !isInternalResource(root.refund) ? root.refund : root;
  const currency = readString(source.currency) ?? readString(root.currency);
  const paid = moneyLabel(source.paidAmount ?? source.paid ?? root.paidAmountLabel, currency);
  const fee = moneyLabel(
    source.cancellationFee ?? source.fee ?? source.feeAmount ?? root.cancellationFeeLabel,
    currency,
  );
  const refundable = moneyLabel(
    source.refundableAmount ?? source.refundAmount ?? source.refundable ?? root.refundableAmountLabel,
    currency,
  );
  return {
    status: adaptRefundStatus(source.status ?? source.refundStatus ?? root.refundStatus),
    paidAmount: paid ? { label: paid } : undefined,
    cancellationFee: fee ? { label: fee } : undefined,
    refundableAmount: refundable ? { label: refundable } : undefined,
    methodLabel:
      asSafeText(source.methodLabel) ??
      asSafeText(source.refundMethod) ??
      asSafeText(source.method),
    processingEstimate:
      asSafeText(source.processingEstimate) ??
      asSafeText(source.estimateLabel) ??
      asSafeText(source.processingTime),
    note: asSafeText(source.note) ?? asSafeText(source.disclaimer),
  };
}

function adaptPolicy(source: unknown, fallbackTitle?: string): PolicySnapshot {
  if (!isRecord(source) || isInternalResource(source)) {
    return fallbackTitle ? { title: fallbackTitle } : {};
  }
  const summary =
    asSafeText(source.summary) ??
    asSafeText(source.description) ??
    asSafeText(source.text);
  const title = asSafeText(source.title) ?? fallbackTitle;
  const deadlineLabel = asSafeText(source.deadlineLabel) ?? asSafeText(source.deadline);
  const feeLabel = moneyLabel(source.fee ?? source.feeLabel ?? source.cancellationFee);
  const refundLabel = asSafeText(source.refundLabel) ?? asSafeText(source.refundSummary);
  const policyUrl = readUrl(source.policyUrl) ?? readUrl(source.url) ?? readUrl(source.href);
  const policy: PolicySnapshot = {};
  if (title) policy.title = title;
  if (summary) policy.summary = summary;
  if (deadlineLabel) policy.deadlineLabel = deadlineLabel;
  if (feeLabel) policy.feeLabel = feeLabel;
  if (refundLabel) policy.refundLabel = refundLabel;
  if (policyUrl) policy.policyUrl = policyUrl;
  return policy;
}

function adaptProvider(source: unknown): AppointmentProviderSnapshot | undefined {
  if (!isRecord(source) || isInternalResource(source)) {
    return undefined;
  }
  const modeRaw = readString(source.mode)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (modeRaw === "not_applicable" || modeRaw === "none") {
    return { mode: "not_applicable" };
  }
  const name = asSafeText(source.name) ?? asSafeText(source.displayName) ?? asSafeText(source.publicName);
  const title = asSafeText(source.title) ?? asSafeText(source.publicTitle);
  if (modeRaw === "automatic" || modeRaw === "pending_assignment" || modeRaw === "pending") {
    const view: AppointmentProviderSnapshot = { mode: "pending_assignment" };
    if (name) view.name = name;
    if (title) view.title = title;
    return view;
  }
  if (name) {
    return {
      mode: modeRaw === "assigned" ? "assigned" : "specific",
      name,
      title,
    };
  }
  if (modeRaw === "any" || modeRaw === "assigned" || modeRaw === "specific") {
    return { mode: "pending_assignment" };
  }
  return undefined;
}

function adaptAppointmentSnapshot(root: Record<string, unknown>): CancellationAppointmentSnapshot | null {
  const source =
    (isRecord(root.appointment) && !isInternalResource(root.appointment) ? root.appointment : undefined) ??
    root;
  const publicReference =
    publicId(source.publicReference) ??
    publicId(source.reference) ??
    publicId(source.bookingReference) ??
    publicId(source.id);
  const serviceSource = isRecord(source.service) && !isInternalResource(source.service) ? source.service : undefined;
  const serviceName = asSafeText(serviceSource?.name) ?? asSafeText(source.serviceName);
  const startsAt =
    readString(source.startsAt) ??
    readString(source.startAt) ??
    readString(source.scheduledAt);
  const status = parseStatusKey(source.status) ?? parseStatusKey(source.appointmentStatus);
  if (!publicReference || !serviceName || !startsAt || !status) {
    return null;
  }
  const snapshot: CancellationAppointmentSnapshot = {
    publicReference,
    status,
    serviceName,
    startsAt,
  };
  const provider = adaptProvider(source.provider ?? source.assignedProvider);
  if (provider) snapshot.provider = provider;
  const branchSource = isRecord(source.branch) && !isInternalResource(source.branch) ? source.branch : undefined;
  const branchName = asSafeText(branchSource?.name) ?? asSafeText(source.branchName);
  if (branchName) snapshot.branchName = branchName;
  const endsAt = readString(source.endsAt) ?? readString(source.endAt);
  if (endsAt) snapshot.endsAt = endsAt;
  const timezone = readString(source.timezone) ?? readString(source.timeZone);
  if (timezone) snapshot.timezone = timezone;
  const duration = readNumber(source.durationMinutes) ?? readNumber(serviceSource?.durationMinutes);
  if (typeof duration === "number" && Number.isInteger(duration) && duration > 0) {
    snapshot.durationMinutes = duration;
  }
  const paymentStatus =
    parseStatusKey(source.paymentStatus) ??
    parseStatusKey(isRecord(source.payment) ? source.payment.status : undefined);
  if (paymentStatus) snapshot.paymentStatus = paymentStatus;
  return snapshot;
}

function adaptReason(value: unknown): CancellationReasonOption | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const code = readString(value.code) ?? readString(value.id) ?? readString(value.reasonCode);
  const label = asSafeText(value.label) ?? asSafeText(value.title) ?? asSafeText(value.name);
  if (!code || !label) {
    return null;
  }
  const reason: CancellationReasonOption = { code, label };
  if (readBoolean(value.requiresText) === true || code === "other" || code === "other_reason") {
    reason.requiresText = true;
  }
  const maxLength = readNumber(value.maxLength) ?? readNumber(value.textMaxLength);
  if (typeof maxLength === "number" && maxLength > 0) {
    reason.maxLength = maxLength;
  }
  return reason;
}

export function adaptCancellationPreview(payload: unknown): CancellationPreviewView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointment = adaptAppointmentSnapshot(root);
  if (!appointment) {
    return null;
  }
  const nested = isRecord(root.preview) ? root.preview : root;
  const explicit = readBoolean(nested.canCancel) !== undefined || readBoolean(root.canCancel) !== undefined;
  const canCancel = explicit
    ? readBoolean(nested.canCancel) === true || readBoolean(root.canCancel) === true
    : false;
  const preview: CancellationPreviewView = {
    appointment,
    canCancel,
    policy: adaptPolicy(
      nested.policy ?? nested.cancellationPolicy ?? root.cancellationPolicy ?? root.policy,
      "سیاست لغو",
    ),
    refund: adaptRefund(nested.refund ? nested : root),
  };
  const blockedReason =
    asSafeText(nested.blockedReason) ??
    asSafeText(root.blockedReason) ??
    asSafeText(nested.reason);
  if (blockedReason) preview.blockedReason = blockedReason;
  const reasons = asList(nested.allowedReasons ?? nested.reasons ?? root.allowedReasons, [
    "allowedReasons",
    "reasons",
    "cancellationReasons",
  ])
    .map((item) => adaptReason(item))
    .filter((item): item is CancellationReasonOption => Boolean(item));
  if (reasons.length > 0) preview.allowedReasons = reasons;
  const previewVersion =
    readString(nested.previewVersion) ??
    readString(nested.version) ??
    readString(root.previewVersion);
  if (previewVersion) preview.previewVersion = previewVersion;
  const expiresAt = readString(nested.expiresAt) ?? readString(nested.previewExpiresAt);
  if (expiresAt) preview.expiresAt = expiresAt;
  const reasonMaxLength = readNumber(nested.reasonMaxLength) ?? readNumber(root.reasonMaxLength);
  if (typeof reasonMaxLength === "number" && reasonMaxLength > 0) {
    preview.reasonMaxLength = reasonMaxLength;
  }
  return preview;
}

export function adaptCancellationResult(payload: unknown): CancellationResultView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointmentReference =
    publicId(root.appointmentReference) ??
    publicId(root.publicReference) ??
    publicId(root.reference) ??
    publicId(root.bookingReference) ??
    publicId(isRecord(root.appointment) ? root.appointment.publicReference : undefined);
  const status = parseStatusKey(root.status) ?? parseStatusKey(root.appointmentStatus) ?? "cancelled";
  if (!appointmentReference) {
    return null;
  }
  const result: CancellationResultView = {
    appointmentReference,
    status,
    refund: adaptRefund(root),
  };
  const cancelledAt =
    readString(root.cancelledAt) ??
    readString(root.canceledAt) ??
    readString(root.completedAt);
  if (cancelledAt) result.cancelledAt = cancelledAt;
  const cancellationReference = publicId(root.cancellationReference) ?? publicId(root.id);
  if (cancellationReference) result.cancellationReference = cancellationReference;
  const message = asSafeText(root.message) ?? asSafeText(root.summary);
  if (message) result.message = message;
  return result;
}

export function refundStatusLabel(status: CancellationRefundStatus): string {
  if (status === "full") return "بازپرداخت کامل";
  if (status === "partial") return "بازپرداخت جزئی";
  if (status === "pending_calculation") return "در انتظار محاسبه بازپرداخت";
  if (status === "already_refunded") return "بازپرداخت‌شده";
  if (status === "processing") return "بازپرداخت در حال پردازش";
  return "بدون بازپرداخت";
}

export function cancellationSuccessHeadline(
  refund: CancellationRefundView,
): { title: string; description: string } {
  if (refund.status === "processing" || refund.status === "pending_calculation") {
    return {
      title: "نوبت شما لغو شد.",
      description: "لغو نوبت ثبت شد. وضعیت بازپرداخت هنوز نهایی نشده است.",
    };
  }
  if (refund.status === "full" || refund.status === "partial") {
    return {
      title: "نوبت شما لغو شد.",
      description: "لغو نوبت ثبت شد. جزئیات بازپرداخت از سرویس دریافت شده است.",
    };
  }
  if (refund.status === "already_refunded") {
    return {
      title: "نوبت شما لغو شد.",
      description: "این نوبت لغو شده و بازپرداخت قبلاً انجام شده است.",
    };
  }
  return {
    title: "نوبت شما لغو شد.",
    description: "لغو نوبت ثبت شد. بازپرداختی برای این نوبت اعلام نشده است.",
  };
}

export function validateCancellationReason(input: {
  allowedReasons?: CancellationReasonOption[];
  selectedCode?: string;
  reasonText?: string;
  maxLength?: number;
}): string | undefined {
  const maxLen = input.maxLength ?? DEFAULT_CANCELLATION_REASON_MAX_LENGTH;
  const reasons = input.allowedReasons ?? [];
  if (reasons.length > 0) {
    if (!input.selectedCode) {
      return "لطفاً دلیل لغو را انتخاب کنید.";
    }
    const selected = reasons.find((item) => item.code === input.selectedCode);
    if (!selected) {
      return "دلیل انتخاب‌شده معتبر نیست.";
    }
    if (selected.requiresText) {
      const text = input.reasonText?.trim();
      if (!text) {
        return "لطفاً توضیح دلیل لغو را وارد کنید.";
      }
      const limit = selected.maxLength ?? maxLen;
      if (text.length > limit) {
        return `توضیح دلیل لغو نباید بیش از ${limit} کاراکتر باشد.`;
      }
    }
    return undefined;
  }
  const text = input.reasonText?.trim();
  if (text && text.length > maxLen) {
    return `توضیح دلیل لغو نباید بیش از ${maxLen} کاراکتر باشد.`;
  }
  return undefined;
}
