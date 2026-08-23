import { formatCurrencyAmount } from "@/lib/date-time/format";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asSafeText, readUrl, unwrapPayload } from "@/lib/public/read";
import { parseStatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  BookingConfirmationView,
  ConfirmationBranchView,
  ConfirmationProviderView,
  ConfirmationResultKind,
} from "@/types/confirmation";

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
  const labeled = asSafeText(value.label) ?? asSafeText(value.formatted) ?? asSafeText(value.amountLabel);
  if (labeled) {
    return labeled;
  }
  if (typeof value.amount === "number" && Number.isInteger(value.amount) && value.amount !== 0) {
    return formatCurrencyAmount(value.amount, readString(value.currency) ?? currency);
  }
  return undefined;
}

function publicReference(value: unknown): string | undefined {
  const raw = asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function adaptProvider(root: Record<string, unknown>): ConfirmationProviderView | undefined {
  const source = isRecord(root.provider) && !isInternalResource(root.provider) ? root.provider : undefined;
  const modeRaw = (
    readString(source?.mode) ??
    readString(source?.assignment) ??
    readString(root.providerAssignment) ??
    readString(root.providerMode)
  )?.toLowerCase().replace(/[\s-]+/g, "_");
  if (
    modeRaw === "not_applicable" ||
    modeRaw === "none" ||
    modeRaw === "omitted"
  ) {
    return { mode: "not_applicable" };
  }
  const name =
    asSafeText(source?.name) ??
    asSafeText(source?.displayName) ??
    asSafeText(source?.publicName) ??
    asSafeText(root.providerName);
  const title = asSafeText(source?.title) ?? asSafeText(source?.publicTitle);
  if (modeRaw === "automatic" || modeRaw === "pending_assignment" || modeRaw === "pending") {
    return { mode: "pending_assignment", name, title };
  }
  if (name) {
    return {
      mode: modeRaw === "assigned" || modeRaw === "automatic_assigned" ? "assigned" : "specific",
      name,
      title,
    };
  }
  if (modeRaw === "any" || modeRaw === "assigned" || modeRaw === "specific") {
    return { mode: "pending_assignment" };
  }
  return undefined;
}

function adaptBranch(root: Record<string, unknown>): ConfirmationBranchView | undefined {
  const source = isRecord(root.branch) && !isInternalResource(root.branch) ? root.branch : undefined;
  const name = asSafeText(source?.name) ?? asSafeText(root.branchName);
  if (!name) {
    return undefined;
  }
  return {
    name,
    address: asSafeText(source?.address) ?? asSafeText(root.branchAddress),
    phone: asSafeText(source?.phone),
    directionsUrl: readUrl(source?.directionsUrl) ?? readUrl(source?.mapUrl),
  };
}

export function adaptBookingConfirmation(payload: unknown): BookingConfirmationView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const id =
    (isSafePublicId(readString(root.id)) ? readString(root.id) : undefined) ??
    (isSafePublicId(readString(root.appointmentId)) ? readString(root.appointmentId) : undefined) ??
    (isSafePublicId(readString(root.bookingId)) ? readString(root.bookingId) : undefined);
  const serviceSource = isRecord(root.service) && !isInternalResource(root.service) ? root.service : undefined;
  const serviceName = asSafeText(serviceSource?.name) ?? asSafeText(root.serviceName);
  const startsAt =
    readString(root.startsAt) ??
    readString(root.startAt) ??
    readString(root.scheduledAt) ??
    (isRecord(root.slot) ? readString(root.slot.startsAt) : undefined);
  const status = parseStatusKey(root.status) ?? parseStatusKey(root.appointmentStatus);
  if (!id || !serviceName || !startsAt || !status) {
    return null;
  }

  const pricingRoot = isRecord(root.pricing) ? root.pricing : isRecord(root.payment) ? root.payment : root;
  const currency = readString(pricingRoot.currency) ?? readString(root.currency);
  const view: BookingConfirmationView = {
    id,
    status,
    serviceName,
    startsAt,
    pricing: {
      totalLabel: moneyLabel(
        pricingRoot.totalAmount ?? pricingRoot.totalLabel ?? root.totalAmountLabel,
        currency,
      ),
      paidLabel: moneyLabel(pricingRoot.paidAmount ?? pricingRoot.paidLabel ?? root.paidAmountLabel, currency),
      remainingLabel: moneyLabel(
        pricingRoot.remainingAmount ?? pricingRoot.remainingLabel ?? root.remainingAmountLabel,
        currency,
      ),
      currency,
    },
  };
  const reference = publicReference(root.reference) ?? publicReference(root.bookingReference);
  if (reference) view.reference = reference;
  const paymentStatus = parseStatusKey(root.paymentStatus) ?? parseStatusKey(isRecord(root.payment) ? root.payment.status : undefined);
  if (paymentStatus) view.paymentStatus = paymentStatus;
  const provider = adaptProvider(root);
  if (provider && provider.mode !== "not_applicable") view.provider = provider;
  const branch = adaptBranch(root);
  if (branch) view.branch = branch;
  const endsAt =
    readString(root.endsAt) ??
    readString(root.endAt) ??
    (isRecord(root.slot) ? readString(root.slot.endsAt) : undefined);
  if (endsAt) view.endsAt = endsAt;
  const timezone = readString(root.timezone) ?? readString(root.timeZone);
  if (timezone) view.timezone = timezone;
  if (typeof root.durationMinutes === "number" && Number.isInteger(root.durationMinutes)) {
    view.durationMinutes = root.durationMinutes;
  }
  const transactionReference = publicReference(
    root.transactionReference ?? (isRecord(root.payment) ? root.payment.transactionReference ?? root.payment.publicReference : undefined),
  );
  if (transactionReference) view.transactionReference = transactionReference;
  const instructions = asSafeText(root.instructions) ?? asSafeText(root.customerInstructions);
  if (instructions) view.instructions = instructions;
  return view;
}

export function confirmationResultKind(view: BookingConfirmationView): ConfirmationResultKind {
  if (view.status === "pending") {
    return "pending";
  }
  if (
    view.paymentStatus === "pendingPayment" ||
    view.paymentStatus === "failed" ||
    view.paymentStatus === "unpaid"
  ) {
    return "payment_pending";
  }
  if (view.paymentStatus === "payAtLocation") {
    return "pay_at_location";
  }
  if (view.status === "scheduled") {
    return "scheduled";
  }
  if (view.status === "confirmed") {
    return "confirmed";
  }
  return "unknown";
}

export function confirmationHeadline(kind: ConfirmationResultKind): {
  title: string;
  description: string;
  showSuccessIcon: boolean;
} {
  if (kind === "pending") {
    return {
      title: "درخواست نوبت شما ثبت شد و در انتظار تأیید مجموعه است.",
      description: "این نوبت هنوز نهایی نشده است. پس از بررسی مجموعه، وضعیت به‌روز می‌شود.",
      showSuccessIcon: false,
    };
  }
  if (kind === "payment_pending") {
    return {
      title: "نوبت در انتظار پرداخت است.",
      description: "تا دریافت وضعیت پرداخت از سرویس، این رزرو نهایی نیست.",
      showSuccessIcon: false,
    };
  }
  if (kind === "pay_at_location") {
    return {
      title: "نوبت شما ثبت شد.",
      description: "پرداخت هنگام مراجعه به مجموعه انجام می‌شود.",
      showSuccessIcon: false,
    };
  }
  if (kind === "scheduled") {
    return {
      title: "نوبت شما با موفقیت ثبت شد.",
      description: "زمان نوبت در تقویم مجموعه ثبت شده است.",
      showSuccessIcon: true,
    };
  }
  if (kind === "confirmed") {
    return {
      title: "نوبت شما با موفقیت ثبت شد.",
      description: "جزئیات نوبت از سرویس رزرو خوانده شده است.",
      showSuccessIcon: true,
    };
  }
  return {
    title: "وضعیت رزرو دریافت شد.",
    description: "جزئیات نمایش‌داده‌شده از پاسخ سرویس نوبت‌دهی است.",
    showSuccessIcon: false,
  };
}

export function confirmationProviderLabel(provider?: ConfirmationProviderView): string | undefined {
  if (!provider || provider.mode === "not_applicable") {
    return undefined;
  }
  if (provider.name) {
    return provider.title ? `${provider.name} — ${provider.title}` : provider.name;
  }
  if (provider.mode === "pending_assignment" || provider.mode === "assigned") {
    return "متخصص توسط مجموعه تعیین می‌شود";
  }
  return undefined;
}
