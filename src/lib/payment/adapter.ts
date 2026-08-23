import { asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { formatCurrencyAmount } from "@/lib/date-time/format";
import { PAYMENT_METHOD_COPY } from "@/types/payment";
import type { BookingQuoteView, QuotePaymentMode } from "@/types/booking";
import type {
  CouponStatus,
  CouponView,
  PaymentMethodType,
  PaymentOptionView,
  PaymentResultStatus,
  PaymentSessionView,
} from "@/types/payment";

const METHOD_TYPES: Record<string, PaymentMethodType> = {
  full: "full",
  pay_full: "full",
  online: "full",
  deposit: "deposit",
  pay_deposit: "deposit",
  pay_at_location: "pay_at_location",
  pay_later: "pay_at_location",
};

const RESULT_STATUSES: Record<string, PaymentResultStatus> = {
  created: "created",
  redirect_required: "redirect_required",
  redirect: "redirect_required",
  processing: "processing",
  pending: "pending",
  pending_payment: "pending",
  paid: "paid",
  success: "paid",
  deposit_paid: "deposit_paid",
  failed: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  expired: "expired",
  pay_at_location: "pay_at_location",
  unknown: "unknown",
};

const COUPON_STATUSES: Record<string, CouponStatus> = {
  applied: "applied",
  valid: "applied",
  invalid: "invalid",
  expired: "expired",
  not_applicable: "not_applicable",
  inapplicable: "not_applicable",
  limit_reached: "limit_reached",
  usage_limit: "limit_reached",
};

const SECRET_KEYS = ["clientSecret", "client_secret", "paymentToken", "card", "pan", "cvv"];

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) && !/^\d+$/.test(raw) ? raw : undefined;
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
  const labeled = asSafeText(value.label) ?? asSafeText(value.formatted) ?? asSafeText(value.amountLabel);
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

function methodType(value: unknown): PaymentMethodType | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  return raw ? METHOD_TYPES[raw] : undefined;
}

export function requiresHoldForMethod(type: PaymentMethodType): boolean {
  return type === "full" || type === "deposit";
}

export function optionFromPaymentMode(
  mode: QuotePaymentMode,
  quote: BookingQuoteView,
): PaymentOptionView | undefined {
  if (mode !== "full" && mode !== "deposit" && mode !== "pay_at_location") {
    return undefined;
  }
  const copy = PAYMENT_METHOD_COPY[mode];
  const option: PaymentOptionView = {
    type: mode,
    title: copy.title,
    description: copy.description,
  };
  if (quote.payableNowLabel) option.payableNowLabel = quote.payableNowLabel;
  if (quote.payableAtLocationLabel) {
    option.remainingAtLocationLabel = quote.payableAtLocationLabel;
    option.remainingDueLabel = "مانده هنگام مراجعه پرداخت می‌شود.";
  }
  if (mode === "deposit" && quote.policySnapshot?.refundability) {
    option.refundability = quote.policySnapshot.refundability;
  }
  return option;
}

export function adaptPaymentOptions(quote: BookingQuoteView, payload?: unknown): PaymentOptionView[] {
  const root = isRecord(payload) ? payload : undefined;
  const list = root && Array.isArray(root.paymentMethods)
    ? root.paymentMethods
    : root && Array.isArray(root.paymentOptions)
      ? root.paymentOptions
      : undefined;
  if (list) {
    const mapped = list
      .map((item): PaymentOptionView | undefined => {
        if (!isRecord(item) || isInternalResource(item)) {
          return undefined;
        }
        const type = methodType(item.type ?? item.method ?? item.id);
        if (!type) {
          return undefined;
        }
        const copy = PAYMENT_METHOD_COPY[type];
        const option: PaymentOptionView = {
          type,
          title: asSafeText(item.title) ?? copy.title,
          description: asSafeText(item.description) ?? copy.description,
        };
        const payable = moneyLabel(item.payableNow ?? item.payableNowLabel, quote.currency, true);
        if (payable) option.payableNowLabel = payable;
        const remaining = moneyLabel(
          item.remainingAtLocation ?? item.payableAtLocation ?? item.remainingAmount,
          quote.currency,
          true,
        );
        if (remaining) {
          option.remainingAtLocationLabel = remaining;
          option.remainingDueLabel =
            asSafeText(item.remainingDueLabel) ?? "مانده هنگام مراجعه پرداخت می‌شود.";
        }
        const refundability = asSafeText(item.refundability) ?? quote.policySnapshot?.refundability;
        if (type === "deposit" && refundability) option.refundability = refundability;
        return option;
      })
      .filter((item): item is PaymentOptionView => Boolean(item));
    if (mapped.length > 0) {
      return mapped;
    }
  }
  const fallback = optionFromPaymentMode(quote.paymentMode, quote);
  return fallback ? [fallback] : [];
}

export function adaptCoupon(payload: unknown): CouponView | undefined {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return undefined;
  }
  const source = isRecord(root.coupon) ? root.coupon : root;
  const code = asSafeText(source.code) ?? asSafeText(source.couponCode);
  const statusRaw = readString(source.status ?? source.result)?.toLowerCase().replace(/[\s-]+/g, "_");
  const status = statusRaw ? COUPON_STATUSES[statusRaw] : undefined;
  if (!code || !status) {
    return undefined;
  }
  const view: CouponView = { code, status };
  const message = asSafeText(source.message) ?? asSafeText(source.reason);
  if (message) view.message = message;
  return view;
}

export function adaptPaymentSession(payload: unknown): PaymentSessionView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  for (const key of Object.keys(root)) {
    if (SECRET_KEYS.some((secret) => key.replace(/[\s_-]/g, "").toLowerCase().includes(secret.replace(/[\s_-]/g, "").toLowerCase()))) {
      // ignored
    }
  }
  const paymentId =
    publicId(root.publicReference) ??
    publicId(root.reference) ??
    publicId(root.paymentId) ??
    publicId(root.id);
  if (!paymentId) {
    return null;
  }
  const statusRaw = readString(root.status ?? root.result)?.toLowerCase().replace(/[\s-]+/g, "_");
  const view: PaymentSessionView = {
    paymentId,
    status: (statusRaw && RESULT_STATUSES[statusRaw]) || (root.redirectUrl ? "redirect_required" : "unknown"),
  };
  const publicReference = publicId(root.publicReference) ?? publicId(root.reference) ?? paymentId;
  if (publicReference) view.publicReference = publicReference;
  const redirectUrl = readString(root.redirectUrl) ?? readString(root.gatewayUrl);
  if (redirectUrl) view.redirectUrl = redirectUrl;
  const expiresAt = readString(root.expiresAt);
  if (expiresAt) view.expiresAt = expiresAt;
  const gatewayName = asSafeText(root.gatewayName) ?? asSafeText(root.gateway);
  if (gatewayName) view.gatewayName = gatewayName;
  const payable = moneyLabel(root.payableNowLabel ?? root.amountLabel ?? (isRecord(root.pricing) ? root.pricing.payableNow : undefined));
  if (payable) view.payableNowLabel = payable;
  const bookingReference = publicId(root.bookingReference) ?? publicId(root.appointmentId);
  if (bookingReference) view.bookingReference = bookingReference;
  const transactionReference = publicId(root.transactionReference) ?? publicId(isRecord(root.transaction) ? root.transaction.reference : undefined);
  if (transactionReference) view.transactionReference = transactionReference;
  const paidAt = readString(root.paidAt) ?? readString(root.completedAt);
  if (paidAt) view.paidAt = paidAt;
  if (readBoolean(root.retryAllowed) !== undefined) view.retryAllowed = readBoolean(root.retryAllowed);
  if (readBoolean(root.alreadyPaid) === true || statusRaw === "already_paid") view.alreadyPaid = true;
  if (readBoolean(root.alreadyProcessing) === true || statusRaw === "already_processing") view.alreadyProcessing = true;
  return view;
}

export function paymentReferenceFromSearch(search: { get(name: string): string | null }): string | undefined {
  const ref = search.get("ref") ?? search.get("paymentRef");
  return publicId(ref);
}
