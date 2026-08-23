import { readString } from "@/lib/utilities/records";

export type StatusKey =
  | "pending"
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "checkedIn"
  | "inProgress"
  | "completed"
  | "cancelled"
  | "noShow"
  | "pendingPayment"
  | "processing"
  | "paid"
  | "depositPaid"
  | "payAtLocation"
  | "unpaid"
  | "failed"
  | "expired"
  | "refunded"
  | "partiallyRefunded"
  | "unknown";

export type StatusTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "information";

export type StatusPresentation = {
  key: StatusKey;
  label: string;
  tone: StatusTone;
};

const STATUS_MAP: Record<StatusKey, Omit<StatusPresentation, "key">> = {
  pending: { label: "در انتظار تأیید", tone: "warning" },
  scheduled: { label: "زمان‌بندی‌شده", tone: "primary" },
  confirmed: { label: "تأییدشده", tone: "primary" },
  rescheduled: { label: "زمان‌بندی‌شده مجدد", tone: "information" },
  checkedIn: { label: "ورود ثبت شد", tone: "information" },
  inProgress: { label: "در حال انجام", tone: "information" },
  completed: { label: "انجام‌شده", tone: "success" },
  cancelled: { label: "لغوشده", tone: "danger" },
  noShow: { label: "حاضر نشد", tone: "warning" },
  pendingPayment: { label: "در انتظار پرداخت", tone: "warning" },
  processing: { label: "در حال پردازش", tone: "information" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  depositPaid: { label: "بیعانه پرداخت شده", tone: "information" },
  payAtLocation: { label: "پرداخت در محل", tone: "information" },
  unpaid: { label: "پرداخت‌نشده", tone: "warning" },
  failed: { label: "ناموفق", tone: "danger" },
  expired: { label: "منقضی‌شده", tone: "warning" },
  refunded: { label: "بازپرداخت‌شده", tone: "neutral" },
  partiallyRefunded: { label: "بازپرداخت جزئی", tone: "neutral" },
  unknown: { label: "نامشخص", tone: "neutral" },
};

export function getStatusPresentation(
  key: StatusKey,
  labelOverride?: string,
): StatusPresentation {
  const mapped = STATUS_MAP[key];
  return {
    key,
    tone: mapped.tone,
    label: labelOverride ?? mapped.label,
  };
}

const STATUS_ALIASES: Record<string, StatusKey> = {
  pending: "pending",
  pending_confirmation: "pending",
  pendingconfirmation: "pending",
  scheduled: "scheduled",
  confirmed: "confirmed",
  rescheduled: "rescheduled",
  checked_in: "checkedIn",
  checkedin: "checkedIn",
  in_progress: "inProgress",
  inprogress: "inProgress",
  completed: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  no_show: "noShow",
  noshow: "noShow",
  pending_payment: "pendingPayment",
  pendingpayment: "pendingPayment",
  payment_pending: "pendingPayment",
  paymentpending: "pendingPayment",
  processing: "processing",
  paid: "paid",
  success: "paid",
  deposit_paid: "depositPaid",
  depositpaid: "depositPaid",
  pay_at_location: "payAtLocation",
  payatlocation: "payAtLocation",
  pay_later: "payAtLocation",
  paylater: "payAtLocation",
  unpaid: "unpaid",
  failed: "failed",
  expired: "expired",
  refunded: "refunded",
  partially_refunded: "partiallyRefunded",
  partiallyrefunded: "partiallyRefunded",
  partial_refund: "partiallyRefunded",
  refund_pending: "pendingPayment",
  pending_refund: "pendingPayment",
  unknown: "unknown",
};

export function parseStatusKey(value: unknown): StatusKey | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return undefined;
  }
  return STATUS_ALIASES[raw.replace(/_/g, "")] ?? STATUS_ALIASES[raw];
}
