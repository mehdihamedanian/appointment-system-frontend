import { formatAppointmentParts, formatCurrencyAmount } from "@/lib/date-time/format";
import { appointmentProviderLabel } from "@/lib/customer/appointment-detail-adapter";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asSafeText,
  readBoolean,
  readNumber,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import { parseStatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type { PolicySnapshot, PublicBusinessContact } from "@/types/appointment-detail";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";
import type {
  RescheduleAppointmentSnapshot,
  RescheduleChangePermissions,
  RescheduleFinancialAdjustment,
  ReschedulePreviewView,
  RescheduleProposedSnapshot,
  RescheduleQuoteView,
  RescheduleResultView,
  RescheduleSelectionContext,
} from "@/types/appointment-reschedule";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

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

function adaptProviderMode(value: unknown): ProviderSelectionMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "required" || raw === "mandatory") return "required";
  if (raw === "optional") return "optional";
  if (raw === "automatic" || raw === "auto") return "automatic";
  return "not_applicable";
}

function adaptProviderPreference(source: unknown): ProviderPreference {
  if (!isRecord(source) || isInternalResource(source)) {
    return { type: "not_applicable" };
  }
  const typeRaw = readString(source.type)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (typeRaw === "any" || typeRaw === "no_preference") {
    return { type: "any" };
  }
  if (typeRaw === "automatic" || typeRaw === "auto") {
    return { type: "automatic" };
  }
  if (typeRaw === "not_applicable" || typeRaw === "none") {
    return { type: "not_applicable" };
  }
  const providerId =
    publicId(source.providerId) ?? publicId(source.id) ?? publicId(source.value);
  if (providerId) {
    return { type: "specific", providerId };
  }
  return { type: "not_applicable" };
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
  const id = publicId(source.id) ?? publicId(source.providerId);
  if (modeRaw === "automatic" || modeRaw === "pending_assignment" || modeRaw === "pending") {
    const view: AppointmentProviderSnapshot = { mode: "pending_assignment" };
    if (name) view.name = name;
    if (title) view.title = title;
    if (id) view.id = id;
    return view;
  }
  if (name) {
    return {
      mode: modeRaw === "assigned" ? "assigned" : "specific",
      name,
      title,
      id,
    };
  }
  if (modeRaw === "any" || modeRaw === "assigned" || modeRaw === "specific") {
    return { mode: "pending_assignment", id };
  }
  return undefined;
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
  const feeLabel = moneyLabel(source.fee ?? source.feeLabel ?? source.rescheduleFee);
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

function adaptFinancial(source: unknown): RescheduleFinancialAdjustment {
  const root = isRecord(source) && !isInternalResource(source) ? source : {};
  const statusRaw = readString(root.status ?? root.adjustmentStatus ?? root.paymentImpact)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  let status: RescheduleFinancialAdjustment["status"] = "none";
  if (statusRaw === "additional_payment" || statusRaw === "payment_required") {
    status = "additional_payment";
  } else if (statusRaw === "partial_refund") {
    status = "partial_refund";
  } else if (statusRaw === "refund_pending" || statusRaw === "pending_refund") {
    status = "refund_pending";
  } else if (statusRaw === "payment_pending") {
    status = "payment_pending";
  } else if (statusRaw === "pending_calculation" || statusRaw === "calculating") {
    status = "pending_calculation";
  }
  const currency = readString(root.currency);
  const financial: RescheduleFinancialAdjustment = { status };
  const current = moneyLabel(root.currentAmount ?? root.currentAmountLabel, currency);
  const next = moneyLabel(root.newAmount ?? root.newAmountLabel, currency);
  const diff = moneyLabel(root.difference ?? root.differenceLabel ?? root.adjustmentLabel, currency);
  const deposit = moneyLabel(root.deposit ?? root.depositLabel, currency);
  const refund = moneyLabel(root.refund ?? root.refundLabel ?? root.refundableAmount, currency);
  if (current) financial.currentAmountLabel = current;
  if (next) financial.newAmountLabel = next;
  if (diff) financial.differenceLabel = diff;
  if (deposit) financial.depositLabel = deposit;
  if (refund) financial.refundLabel = refund;
  const note = asSafeText(root.note) ?? asSafeText(root.disclaimer);
  if (note) financial.note = note;
  const payHref = readUrl(root.payHref) ?? readUrl(root.paymentUrl);
  if (payHref) financial.payHref = payHref;
  const holdReference = publicId(root.holdReference) ?? publicId(root.holdId);
  if (holdReference) financial.holdReference = holdReference;
  const expiresAt = readString(root.expiresAt) ?? readString(root.holdExpiresAt);
  if (expiresAt) financial.expiresAt = expiresAt;
  return financial;
}

function adaptAppointmentSnapshot(root: Record<string, unknown>): RescheduleAppointmentSnapshot | null {
  const source =
    (isRecord(root.appointment) && !isInternalResource(root.appointment) ? root.appointment : undefined) ??
    root;
  const publicReference =
    publicId(source.publicReference) ??
    publicId(source.reference) ??
    publicId(source.bookingReference) ??
    publicId(source.id);
  const serviceId =
    publicId(isRecord(source.service) ? source.service.id : undefined) ??
    publicId(source.serviceId);
  const serviceSource = isRecord(source.service) && !isInternalResource(source.service) ? source.service : undefined;
  const serviceName = asSafeText(serviceSource?.name) ?? asSafeText(source.serviceName);
  const startsAt =
    readString(source.startsAt) ??
    readString(source.startAt) ??
    readString(source.scheduledAt);
  const status = parseStatusKey(source.status) ?? parseStatusKey(source.appointmentStatus);
  if (!publicReference || !serviceId || !serviceName || !startsAt || !status) {
    return null;
  }
  const snapshot: RescheduleAppointmentSnapshot = {
    publicReference,
    status,
    serviceId,
    serviceName,
    startsAt,
  };
  const provider = adaptProvider(source.provider ?? source.assignedProvider);
  if (provider) snapshot.provider = provider;
  const branchSource = isRecord(source.branch) && !isInternalResource(source.branch) ? source.branch : undefined;
  const branchId = publicId(branchSource?.id) ?? publicId(source.branchId);
  const branchName = asSafeText(branchSource?.name) ?? asSafeText(source.branchName);
  if (branchId) snapshot.branchId = branchId;
  if (branchName) snapshot.branchName = branchName;
  const endsAt = readString(source.endsAt) ?? readString(source.endAt);
  if (endsAt) snapshot.endsAt = endsAt;
  const timezone = readString(source.timezone) ?? readString(source.timeZone);
  if (timezone) snapshot.timezone = timezone;
  const duration =
    readNumber(source.durationMinutes) ??
    readNumber(serviceSource?.durationMinutes);
  if (typeof duration === "number" && Number.isInteger(duration) && duration > 0) {
    snapshot.durationMinutes = duration;
  }
  const paymentStatus =
    parseStatusKey(source.paymentStatus) ??
    parseStatusKey(isRecord(source.payment) ? source.payment.status : undefined);
  if (paymentStatus) snapshot.paymentStatus = paymentStatus;
  return snapshot;
}

function adaptSelectionContext(root: Record<string, unknown>, appointment: RescheduleAppointmentSnapshot): RescheduleSelectionContext {
  const nested =
    (isRecord(root.selection) && !isInternalResource(root.selection) ? root.selection : undefined) ??
    (isRecord(root.availabilityContext) ? root.availabilityContext : undefined) ??
    root;
  const serviceId = publicId(nested.serviceId) ?? appointment.serviceId;
  const branchId = publicId(nested.branchId) ?? appointment.branchId;
  const providerMode = adaptProviderMode(nested.providerMode ?? nested.providerSelectionMode);
  const requiresBranch =
    readBoolean(nested.requiresBranch) === true ||
    readBoolean(nested.branchRequired) === true ||
    Boolean(branchId);
  const preference =
    nested.providerPreference !== undefined
      ? adaptProviderPreference(nested.providerPreference)
      : appointment.provider?.id
        ? { type: "specific" as const, providerId: appointment.provider.id }
        : appointment.provider?.mode === "pending_assignment"
          ? ({ type: "any" } as const)
          : ({ type: "not_applicable" } as const);
  const timezone = readString(nested.timezone) ?? appointment.timezone;
  return {
    serviceId,
    branchId,
    providerPreference: preference,
    requiresBranch,
    providerMode,
    timezone,
  };
}

function adaptPermissions(root: Record<string, unknown>): RescheduleChangePermissions {
  const nested = isRecord(root.permissions) ? root.permissions : root;
  return {
    allowBranchChange: readBoolean(nested.allowBranchChange) === true || readBoolean(nested.canChangeBranch) === true,
    allowProviderChange:
      readBoolean(nested.allowProviderChange) === true || readBoolean(nested.canChangeProvider) === true,
  };
}

function adaptProposed(root: Record<string, unknown>): RescheduleProposedSnapshot | null {
  const source =
    (isRecord(root.proposed) && !isInternalResource(root.proposed) ? root.proposed : undefined) ??
    (isRecord(root.newAppointment) ? root.newAppointment : undefined) ??
    root;
  const slotId = publicId(source.slotId) ?? publicId(source.id);
  const date = readString(source.date);
  const startsAt = readString(source.startsAt) ?? readString(source.startAt);
  if (!slotId || !date || !startsAt) {
    return null;
  }
  const proposed: RescheduleProposedSnapshot = { date, slotId, startsAt };
  const endsAt = readString(source.endsAt) ?? readString(source.endAt);
  if (endsAt) proposed.endsAt = endsAt;
  const when = formatAppointmentParts(startsAt, readString(source.timezone));
  if (when?.time) proposed.timeLabel = when.time;
  const provider = adaptProvider(source.provider);
  if (provider) proposed.provider = provider;
  const branchId = publicId(isRecord(source.branch) ? source.branch.id : source.branchId);
  const branchName = asSafeText(isRecord(source.branch) ? source.branch.name : source.branchName);
  if (branchId) proposed.branchId = branchId;
  if (branchName) proposed.branchName = branchName;
  return proposed;
}

function adaptContact(root: Record<string, unknown>): PublicBusinessContact | undefined {
  const source =
    (isRecord(root.contact) && !isInternalResource(root.contact) ? root.contact : undefined) ??
    (isRecord(root.businessContact) && !isInternalResource(root.businessContact)
      ? root.businessContact
      : undefined);
  if (!source) {
    return undefined;
  }
  const contact: PublicBusinessContact = {};
  const phone = asSafeText(source.phone) ?? asSafeText(source.publicPhone);
  if (phone) contact.phone = phone;
  const email = asSafeText(source.email) ?? asSafeText(source.publicEmail);
  if (email) contact.email = email;
  const address = asSafeText(source.address);
  if (address) contact.address = address;
  const directionsUrl = readUrl(source.directionsUrl) ?? readUrl(source.mapUrl);
  if (directionsUrl) contact.directionsUrl = directionsUrl;
  const hoursLabel = asSafeText(source.hoursLabel) ?? asSafeText(source.hours);
  if (hoursLabel) contact.hoursLabel = hoursLabel;
  const messageUrl = readUrl(source.messageUrl) ?? readUrl(source.contactUrl);
  if (messageUrl) contact.messageUrl = messageUrl;
  return Object.keys(contact).length > 0 ? contact : undefined;
}

export function adaptReschedulePreview(payload: unknown): ReschedulePreviewView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointment = adaptAppointmentSnapshot(root);
  if (!appointment) {
    return null;
  }
  const nested = isRecord(root.preview) ? root.preview : root;
  const explicit =
    readBoolean(nested.canReschedule) !== undefined || readBoolean(root.canReschedule) !== undefined;
  const canReschedule = explicit
    ? readBoolean(nested.canReschedule) === true || readBoolean(root.canReschedule) === true
    : false;
  const preview: ReschedulePreviewView = {
    appointment,
    canReschedule,
    policy: adaptPolicy(
      nested.policy ?? nested.reschedulePolicy ?? root.reschedulePolicy ?? root.policy,
      "سیاست زمان‌بندی مجدد",
    ),
    selection: adaptSelectionContext(root, appointment),
    permissions: adaptPermissions(root),
  };
  const blockedReason =
    asSafeText(nested.blockedReason) ??
    asSafeText(root.blockedReason) ??
    asSafeText(nested.reason);
  if (blockedReason) preview.blockedReason = blockedReason;
  const previewVersion =
    readString(nested.previewVersion) ??
    readString(nested.version) ??
    readString(root.previewVersion);
  if (previewVersion) preview.previewVersion = previewVersion;
  const expiresAt = readString(nested.expiresAt) ?? readString(nested.previewExpiresAt);
  if (expiresAt) preview.expiresAt = expiresAt;
  const warning = asSafeText(nested.warning) ?? asSafeText(root.warning);
  if (warning) preview.warning = warning;
  if (readBoolean(nested.requiresAcknowledgment) === true || readBoolean(root.requiresAcknowledgment) === true) {
    preview.requiresAcknowledgment = true;
  }
  const acknowledgmentLabel =
    asSafeText(nested.acknowledgmentLabel) ?? asSafeText(root.acknowledgmentLabel);
  if (acknowledgmentLabel) preview.acknowledgmentLabel = acknowledgmentLabel;
  const remaining = asSafeText(nested.remainingReschedulesLabel) ?? asSafeText(root.remainingReschedulesLabel);
  if (remaining) preview.remainingReschedulesLabel = remaining;
  const contact = adaptContact(root);
  if (contact) preview.contact = contact;
  return preview;
}

export function adaptRescheduleQuote(payload: unknown): RescheduleQuoteView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointment = adaptAppointmentSnapshot(root);
  const proposed = adaptProposed(root);
  if (!appointment || !proposed) {
    return null;
  }
  const quote: RescheduleQuoteView = {
    current: appointment,
    proposed,
    financial: adaptFinancial(root.financial ?? root.pricing ?? root.paymentImpact ?? root),
    policy: adaptPolicy(
      root.policy ?? root.reschedulePolicy,
      "سیاست زمان‌بندی مجدد",
    ),
  };
  const previewVersion = readString(root.previewVersion) ?? readString(root.version);
  if (previewVersion) quote.previewVersion = previewVersion;
  const warning = asSafeText(root.warning);
  if (warning) quote.warning = warning;
  if (readBoolean(root.requiresAcknowledgment) === true) {
    quote.requiresAcknowledgment = true;
  }
  const acknowledgmentLabel = asSafeText(root.acknowledgmentLabel);
  if (acknowledgmentLabel) quote.acknowledgmentLabel = acknowledgmentLabel;
  return quote;
}

export function adaptRescheduleResult(payload: unknown): RescheduleResultView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointmentReference =
    publicId(root.appointmentReference) ??
    publicId(root.publicReference) ??
    publicId(root.reference) ??
    publicId(isRecord(root.appointment) ? root.appointment.publicReference : undefined);
  const startsAt =
    readString(root.startsAt) ??
    readString(root.startAt) ??
    readString(isRecord(root.appointment) ? root.appointment.startsAt : undefined);
  const status =
    parseStatusKey(root.status) ??
    parseStatusKey(root.appointmentStatus) ??
    "rescheduled";
  if (!appointmentReference || !startsAt) {
    return null;
  }
  const result: RescheduleResultView = {
    appointmentReference,
    status,
    startsAt,
    financial: adaptFinancial(root.financial ?? root.pricing ?? root.paymentImpact ?? root),
  };
  const endsAt = readString(root.endsAt) ?? readString(root.endAt);
  if (endsAt) result.endsAt = endsAt;
  const timezone = readString(root.timezone) ?? readString(root.timeZone);
  if (timezone) result.timezone = timezone;
  const provider = adaptProvider(root.provider ?? (isRecord(root.appointment) ? root.appointment.provider : undefined));
  if (provider) result.provider = provider;
  const branchName =
    asSafeText(isRecord(root.branch) ? root.branch.name : undefined) ??
    asSafeText(root.branchName);
  if (branchName) result.branchName = branchName;
  const rescheduledAt = readString(root.rescheduledAt) ?? readString(root.completedAt);
  if (rescheduledAt) result.rescheduledAt = rescheduledAt;
  const message = asSafeText(root.message) ?? asSafeText(root.summary);
  if (message) result.message = message;
  if (
    readBoolean(root.paymentRequired) === true ||
    result.financial.status === "additional_payment" ||
    result.financial.status === "payment_pending"
  ) {
    result.paymentRequired = true;
  }
  return result;
}

export function financialAdjustmentLabel(financial: RescheduleFinancialAdjustment): string {
  if (financial.status === "additional_payment") return "پرداخت مازاد لازم است";
  if (financial.status === "partial_refund") return "بازپرداخت جزئی";
  if (financial.status === "refund_pending") return "بازپرداخت در انتظار";
  if (financial.status === "payment_pending") return "پرداخت در انتظار";
  if (financial.status === "pending_calculation") return "در انتظار محاسبه مالی";
  return "بدون تغییر مالی";
}

export function rescheduleSuccessHeadline(
  financial: RescheduleFinancialAdjustment,
): { title: string; description: string } {
  if (financial.status === "additional_payment" || financial.status === "payment_pending") {
    return {
      title: "زمان‌بندی مجدد ثبت شد.",
      description: "زمان جدید ثبت شد. تکمیل پرداخت هنوز لازم است.",
    };
  }
  if (financial.status === "partial_refund" || financial.status === "refund_pending") {
    return {
      title: "زمان‌بندی مجدد انجام شد.",
      description: "زمان نوبت به‌روز شد. وضعیت بازپرداخت از سرویس دریافت شده است.",
    };
  }
  return {
    title: "زمان‌بندی مجدد انجام شد.",
    description: "زمان نوبت با موفقیت به‌روز شد.",
  };
}

export function formatRescheduleWhen(
  startsAt: string,
  endsAt: string | undefined,
  timezone: string | undefined,
): { date?: string; time?: string; range?: string } {
  const start = formatAppointmentParts(startsAt, timezone);
  const end = endsAt ? formatAppointmentParts(endsAt, timezone) : null;
  if (!start) {
    return {};
  }
  const range =
    start.time && end?.time ? `${start.time} – ${end.time}` : start.time;
  return { date: start.date, time: start.time, range };
}
