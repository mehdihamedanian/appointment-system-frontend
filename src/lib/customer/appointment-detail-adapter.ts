import { formatCurrencyAmount } from "@/lib/date-time/format";
import {
  adaptActions,
  appointmentProviderLabel,
} from "@/lib/customer/appointment-adapter";
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
import type {
  AppointmentDetailActionsView,
  AppointmentDetailBranchSnapshot,
  AppointmentDetailServiceSnapshot,
  CustomerAppointmentDetailView,
  CustomerTimelineEvent,
  PaymentSummaryView,
  PolicySnapshot,
  PublicBusinessContact,
} from "@/types/appointment-detail";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";

export { appointmentProviderLabel };

const INTERNAL_TIMELINE_KINDS = [
  "resource",
  "allocation",
  "room",
  "device",
  "chair",
  "desk",
  "bed",
  "equipment",
  "machine",
  "internal",
  "audit",
  "staff_performance",
  "admin",
  "staff_note",
  "internal_note",
];

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

function adaptDetailService(root: Record<string, unknown>): AppointmentDetailServiceSnapshot | undefined {
  const source = isRecord(root.service) && !isInternalResource(root.service) ? root.service : undefined;
  const name =
    asSafeText(source?.name) ??
    asSafeText(source?.title) ??
    asSafeText(root.serviceName);
  if (!name) {
    return undefined;
  }
  const snapshot: AppointmentDetailServiceSnapshot = { name };
  const id = publicId(source?.id) ?? publicId(root.serviceId);
  if (id) snapshot.id = id;
  const description =
    asSafeText(source?.publicDescription) ??
    asSafeText(source?.description) ??
    asSafeText(source?.instructions);
  if (description) snapshot.description = description;
  const imageUrl = readUrl(source?.imageUrl) ?? readUrl(source?.thumbnailUrl);
  if (imageUrl) snapshot.imageUrl = imageUrl;
  const duration =
    readNumber(source?.durationMinutes) ??
    readNumber(source?.duration) ??
    readNumber(root.durationMinutes) ??
    readNumber(root.duration);
  if (typeof duration === "number" && Number.isInteger(duration) && duration > 0) {
    snapshot.durationMinutes = duration;
  }
  return snapshot;
}

function adaptDetailProvider(root: Record<string, unknown>): AppointmentProviderSnapshot | undefined {
  const source = isRecord(root.provider) && !isInternalResource(root.provider) ? root.provider : undefined;
  const modeRaw = (
    readString(source?.mode) ??
    readString(source?.assignment) ??
    readString(root.providerAssignment) ??
    readString(root.providerMode)
  )
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (modeRaw === "not_applicable" || modeRaw === "none" || modeRaw === "omitted") {
    return { mode: "not_applicable" };
  }
  const name =
    asSafeText(source?.name) ??
    asSafeText(source?.displayName) ??
    asSafeText(source?.publicName) ??
    asSafeText(root.providerName);
  const title = asSafeText(source?.title) ?? asSafeText(source?.publicTitle);
  const id = publicId(source?.id) ?? publicId(root.providerId);
  if (modeRaw === "automatic" || modeRaw === "pending_assignment" || modeRaw === "pending") {
    const view: AppointmentProviderSnapshot = { mode: "pending_assignment" };
    if (name) view.name = name;
    if (title) view.title = title;
    if (id) view.id = id;
    return view;
  }
  if (name) {
    const view: AppointmentProviderSnapshot = {
      mode: modeRaw === "assigned" || modeRaw === "automatic_assigned" ? "assigned" : "specific",
      name,
    };
    if (title) view.title = title;
    if (id && view.mode === "specific") view.id = id;
    return view;
  }
  if (modeRaw === "any" || modeRaw === "assigned" || modeRaw === "specific") {
    return { mode: "pending_assignment" };
  }
  return undefined;
}

function adaptDetailBranch(root: Record<string, unknown>): AppointmentDetailBranchSnapshot | undefined {
  const source = isRecord(root.branch) && !isInternalResource(root.branch) ? root.branch : undefined;
  const name = asSafeText(source?.name) ?? asSafeText(root.branchName);
  if (!name) {
    return undefined;
  }
  const snapshot: AppointmentDetailBranchSnapshot = { name };
  const id = publicId(source?.id) ?? publicId(root.branchId);
  if (id) snapshot.id = id;
  const address = asSafeText(source?.address) ?? asSafeText(root.branchAddress);
  if (address) snapshot.address = address;
  const phone = asSafeText(source?.phone) ?? asSafeText(source?.publicPhone);
  if (phone) snapshot.phone = phone;
  const directionsUrl = readUrl(source?.directionsUrl) ?? readUrl(source?.mapUrl);
  if (directionsUrl) snapshot.directionsUrl = directionsUrl;
  const visitInstructions =
    asSafeText(source?.visitInstructions) ??
    asSafeText(source?.publicInstructions) ??
    asSafeText(source?.floor);
  if (visitInstructions) snapshot.visitInstructions = visitInstructions;
  return snapshot;
}

function adaptCustomerNote(root: Record<string, unknown>): string | undefined {
  return (
    asSafeText(root.customerNote) ??
    asSafeText(root.customer_note) ??
    asSafeText(isRecord(root.notes) ? root.notes.customer : undefined)
  );
}

function adaptPolicy(source: unknown, fallbackTitle?: string): PolicySnapshot | undefined {
  if (!isRecord(source) || isInternalResource(source)) {
    return undefined;
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
  if (!summary && !title && !deadlineLabel && !feeLabel && !refundLabel && !policyUrl) {
    return undefined;
  }
  const policy: PolicySnapshot = {};
  if (title) policy.title = title;
  if (summary) policy.summary = summary;
  if (deadlineLabel) policy.deadlineLabel = deadlineLabel;
  if (feeLabel) policy.feeLabel = feeLabel;
  if (refundLabel) policy.refundLabel = refundLabel;
  if (policyUrl) policy.policyUrl = policyUrl;
  return policy;
}

function adaptPayment(root: Record<string, unknown>): PaymentSummaryView {
  const paymentRoot = isRecord(root.payment) && !isInternalResource(root.payment) ? root.payment : undefined;
  const pricingRoot = isRecord(root.pricing) ? root.pricing : paymentRoot ?? root;
  const currency = readString(pricingRoot.currency) ?? readString(root.currency);
  const payment: PaymentSummaryView = {
    status:
      parseStatusKey(root.paymentStatus) ??
      parseStatusKey(paymentRoot?.status) ??
      parseStatusKey(pricingRoot.status),
    totalLabel: moneyLabel(
      pricingRoot.totalAmount ?? pricingRoot.totalLabel ?? root.totalAmountLabel,
      currency,
    ),
    paidLabel: moneyLabel(pricingRoot.paidAmount ?? pricingRoot.paidLabel ?? root.paidAmountLabel, currency),
    depositLabel: moneyLabel(
      pricingRoot.depositAmount ?? pricingRoot.depositLabel ?? root.depositAmountLabel,
      currency,
    ),
    remainingLabel: moneyLabel(
      pricingRoot.remainingAmount ?? pricingRoot.remainingLabel ?? root.remainingAmountLabel,
      currency,
    ),
    methodLabel:
      asSafeText(paymentRoot?.methodLabel) ??
      asSafeText(paymentRoot?.method) ??
      asSafeText(pricingRoot.paymentMethod),
    transactionReference: publicId(
      root.transactionReference ??
        paymentRoot?.transactionReference ??
        paymentRoot?.publicReference,
    ),
    refundStatus: parseStatusKey(paymentRoot?.refundStatus) ?? parseStatusKey(root.refundStatus),
    receiptUrl: readUrl(paymentRoot?.receiptUrl) ?? readUrl(paymentRoot?.receiptLink),
  };
  return payment;
}

function adaptDetailActions(root: Record<string, unknown>, now: Date): AppointmentDetailActionsView {
  const base = adaptActions(root, now);
  const nested = isRecord(root.actions) ? root.actions : undefined;
  const source: Record<string, unknown> = nested ?? root;
  const cancelBlockedReason =
    asSafeText(source.cancelBlockedReason) ?? asSafeText(source.cancelReason);
  const rescheduleBlockedReason =
    asSafeText(source.rescheduleBlockedReason) ?? asSafeText(source.rescheduleReason);
  const reviewBlockedReason =
    asSafeText(source.reviewBlockedReason) ?? asSafeText(source.reviewReason);
  const actions: AppointmentDetailActionsView = { ...base };
  if (cancelBlockedReason) actions.cancelBlockedReason = cancelBlockedReason;
  if (rescheduleBlockedReason) actions.rescheduleBlockedReason = rescheduleBlockedReason;
  if (reviewBlockedReason) actions.reviewBlockedReason = reviewBlockedReason;
  return actions;
}

function adaptContact(root: Record<string, unknown>): PublicBusinessContact | undefined {
  const source =
    (isRecord(root.contact) && !isInternalResource(root.contact) ? root.contact : undefined) ??
    (isRecord(root.businessContact) && !isInternalResource(root.businessContact)
      ? root.businessContact
      : undefined) ??
    (isRecord(root.business) && !isInternalResource(root.business) ? root.business : undefined);
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
  const hoursLabel = asSafeText(source.hoursLabel) ?? asSafeText(source.hours) ?? asSafeText(source.contactHours);
  if (hoursLabel) contact.hoursLabel = hoursLabel;
  const messageUrl = readUrl(source.messageUrl) ?? readUrl(source.contactUrl);
  if (messageUrl) contact.messageUrl = messageUrl;
  return Object.keys(contact).length > 0 ? contact : undefined;
}

function timelineState(value: unknown): CustomerTimelineEvent["state"] {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "current" || raw === "in_progress" || raw === "active") {
    return "current";
  }
  if (raw === "error" || raw === "failed") {
    return "error";
  }
  if (raw === "upcoming" || raw === "pending" || raw === "future") {
    return "upcoming";
  }
  return "complete";
}

export function isCustomerVisibleTimelineEvent(value: unknown): boolean {
  if (!isRecord(value) || isInternalResource(value)) {
    return false;
  }
  if (readBoolean(value.internal) === true || readBoolean(value.isInternal) === true) {
    return false;
  }
  if (readBoolean(value.customerVisible) === false || readBoolean(value.staffOnly) === true) {
    return false;
  }
  const kind = (
    readString(value.kind) ??
    readString(value.type) ??
    readString(value.eventType) ??
    ""
  ).toLowerCase();
  if (INTERNAL_TIMELINE_KINDS.some((item) => kind.includes(item))) {
    return false;
  }
  const title =
    asSafeText(value.title) ??
    asSafeText(value.label) ??
    asSafeText(value.summary);
  return Boolean(title);
}

export function adaptTimelineEvent(value: unknown, index: number): CustomerTimelineEvent | null {
  if (!isCustomerVisibleTimelineEvent(value) || !isRecord(value)) {
    return null;
  }
  const title =
    asSafeText(value.title) ??
    asSafeText(value.label) ??
    asSafeText(value.summary);
  if (!title) {
    return null;
  }
  const id =
    publicId(value.id) ??
    publicId(value.eventId) ??
    `${title}-${readString(value.occurredAt) ?? readString(value.at) ?? index}`;
  const event: CustomerTimelineEvent = {
    id,
    title,
    state: timelineState(value.state ?? value.status),
  };
  const description = asSafeText(value.description) ?? asSafeText(value.detail);
  if (description) event.description = description;
  const occurredAt =
    readString(value.occurredAt) ??
    readString(value.at) ??
    readString(value.timestamp) ??
    readString(value.createdAt);
  if (occurredAt) event.occurredAt = occurredAt;
  return event;
}

export function adaptCustomerTimeline(payload: unknown): CustomerTimelineEvent[] {
  const root = unwrapPayload(payload);
  const events = asList(root, ["events", "timeline", "items"]);
  const seen = new Set<string>();
  return events
    .map((item, index) => adaptTimelineEvent(item, index))
    .filter((item): item is CustomerTimelineEvent => {
      if (!item || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
}

export function adaptCustomerAppointmentDetail(
  payload: unknown,
  now = new Date(),
): CustomerAppointmentDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const id =
    publicId(root.publicReference) ??
    publicId(root.reference) ??
    publicId(root.bookingReference) ??
    publicId(root.id) ??
    publicId(root.appointmentId);
  const service = adaptDetailService(root);
  const startsAt =
    readString(root.startsAt) ??
    readString(root.startAt) ??
    readString(root.scheduledAt);
  const status = parseStatusKey(root.status) ?? parseStatusKey(root.appointmentStatus);
  if (!id || !service || !startsAt || !status) {
    return null;
  }
  const view: CustomerAppointmentDetailView = {
    id,
    publicReference:
      publicId(root.publicReference) ??
      publicId(root.reference) ??
      publicId(root.bookingReference) ??
      id,
    status,
    service,
    startsAt,
    payment: adaptPayment(root),
    actions: adaptDetailActions(root, now),
  };
  const provider = adaptDetailProvider(root);
  if (provider) view.provider = provider;
  const branch = adaptDetailBranch(root);
  if (branch) view.branch = branch;
  if (readBoolean(root.singleBranch) === true || readBoolean(root.isSingleBranch) === true) {
    view.singleBranch = true;
  }
  const endsAt = readString(root.endsAt) ?? readString(root.endAt);
  if (endsAt) view.endsAt = endsAt;
  const duration =
    readNumber(root.durationMinutes) ??
    readNumber(root.duration) ??
    service.durationMinutes;
  if (typeof duration === "number" && Number.isInteger(duration) && duration > 0) {
    view.durationMinutes = duration;
  }
  const timezone = readString(root.timezone) ?? readString(root.timeZone);
  if (timezone) view.timezone = timezone;
  const customerNote = adaptCustomerNote(root);
  if (customerNote) view.customerNote = customerNote;
  const embeddedTimeline = adaptCustomerTimeline(root.timeline ?? root.statusTimeline);
  if (embeddedTimeline.length > 0) {
    view.embeddedTimeline = embeddedTimeline;
  }
  const cancellationPolicy = adaptPolicy(
    root.cancellationPolicy ?? root.cancelPolicy,
    "سیاست لغو",
  );
  if (cancellationPolicy) view.cancellationPolicy = cancellationPolicy;
  const reschedulePolicy = adaptPolicy(
    root.reschedulePolicy ?? root.reschedulingPolicy,
    "سیاست زمان‌بندی مجدد",
  );
  if (reschedulePolicy) view.reschedulePolicy = reschedulePolicy;
  const contact = adaptContact(root);
  if (contact) view.contact = contact;
  const updatedAt = readString(root.updatedAt) ?? readString(root.lastUpdatedAt);
  if (updatedAt) view.updatedAt = updatedAt;
  return view;
}
