import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asSafeText, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type { BookingQuoteView, QuotePaymentMode } from "@/types/booking";
import type { SlotHoldStatus, SlotHoldView } from "@/types/hold";

const HOLD_STATUSES: Record<string, SlotHoldStatus> = {
  active: "active",
  held: "active",
  reserved: "active",
  expired: "expired",
  consumed: "consumed",
  used: "consumed",
  completed: "consumed",
  released: "released",
  cancelled: "released",
  canceled: "released",
  invalid: "invalid",
  unknown: "invalid",
};

const SECRET_KEYS = [
  "clientSecret",
  "client_secret",
  "holdToken",
  "paymentToken",
  "secret",
  "lockId",
  "resourceLock",
];

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[\s_-]/g, "").toLowerCase();
  return SECRET_KEYS.some((item) => normalized.includes(item.replace(/[\s_-]/g, "").toLowerCase()));
}

function holdStatus(value: unknown): SlotHoldStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  return (raw && HOLD_STATUSES[raw]) || "invalid";
}

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) && !/^\d+$/.test(raw) ? raw : undefined;
}

export function requiresSlotHold(quote?: Pick<BookingQuoteView, "paymentMode" | "checkoutPath">): boolean {
  if (!quote) {
    return false;
  }
  const mode: QuotePaymentMode = quote.paymentMode;
  return (
    mode === "full" ||
    mode === "deposit" ||
    quote.checkoutPath === "pay_full" ||
    quote.checkoutPath === "pay_deposit"
  );
}

export function adaptSlotHold(payload: unknown): SlotHoldView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const holdId =
    publicId(root.holdId) ??
    publicId(root.id) ??
    publicId(root.publicReference) ??
    publicId(root.reference);
  if (!holdId) {
    return null;
  }
  const slotSource = isRecord(root.slot) && !isInternalResource(root.slot) ? root.slot : undefined;
  const slotId = publicId(slotSource?.id) ?? publicId(root.slotId);
  const view: SlotHoldView = {
    holdId,
    status: holdStatus(root.status ?? root.state),
    slot: {
      id: slotId ?? "",
      startsAt: readString(slotSource?.startsAt) ?? readString(root.startsAt),
    },
  };
  const publicReference = publicId(root.publicReference) ?? publicId(root.reference) ?? holdId;
  if (publicReference) view.publicReference = publicReference;
  const expiresAt = readString(root.expiresAt) ?? readString(root.holdExpiresAt);
  if (expiresAt) view.expiresAt = expiresAt;
  const serverNow = readString(root.serverNow) ?? readString(root.now);
  if (serverNow) view.serverNow = serverNow;
  const paymentContextId = publicId(root.paymentContextId) ?? publicId(root.paymentSessionId);
  if (paymentContextId) view.paymentContextId = paymentContextId;
  const payable = asSafeText(root.payableNowLabel) ?? asSafeText(isRecord(root.pricing) ? root.pricing.payableNow : undefined);
  if (payable) view.payableNowLabel = payable;
  const serviceName =
    asSafeText(root.serviceName) ??
    (isRecord(root.service) ? asSafeText(root.service.name) : undefined);
  if (serviceName) view.serviceName = serviceName;
  const providerLabel =
    asSafeText(root.providerName) ??
    (isRecord(root.provider) ? asSafeText(root.provider.name) : undefined);
  if (providerLabel) view.providerLabel = providerLabel;
  const branchName =
    asSafeText(root.branchName) ?? (isRecord(root.branch) ? asSafeText(root.branch.name) : undefined);
  if (branchName) view.branchName = branchName;
  const timezone = readString(root.timezone);
  if (timezone) view.timezone = timezone;
  const bookingReference = publicId(root.bookingReference) ?? publicId(root.appointmentId);
  if (bookingReference) view.bookingReference = bookingReference;
  const paymentStatus = readString(root.paymentStatus);
  if (paymentStatus) view.paymentStatus = paymentStatus;
  return view;
}

export function holdHasSecretFields(payload: unknown): boolean {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return false;
  }
  return Object.keys(root).some((key) => isSecretKey(key));
}
