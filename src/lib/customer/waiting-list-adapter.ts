import { formatAppointmentParts, formatDurationMinutes, formatRelativeTime } from "@/lib/date-time/format";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, asSafeText, readBoolean, readNumber, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type { ProviderPreference } from "@/types/provider";
import {
  WAITING_LIST_ENTRY_STATUS_LABELS,
  WAITING_LIST_OFFER_STATUS_LABELS,
  WAITING_LIST_TIME_PREFERENCE_LABELS,
  type WaitingListAcceptOutcome,
  type WaitingListDatePreference,
  type WaitingListEligibilityView,
  type WaitingListEntryStatus,
  type WaitingListEntryView,
  type WaitingListListView,
  type WaitingListOfferStatus,
  type WaitingListOfferSummary,
  type WaitingListOfferView,
  type WaitingListTimePreference,
} from "@/types/waiting-list";

const ENTRY_STATUS_ALIASES: Record<string, WaitingListEntryStatus> = {
  active: "active",
  waiting: "active",
  open: "active",
  offered: "offered",
  offer_pending: "offered",
  accepted: "accepted",
  rejected: "rejected",
  expired: "expired",
  fulfilled: "fulfilled",
  completed: "fulfilled",
  booked: "fulfilled",
  cancelled: "cancelled",
  canceled: "cancelled",
  removed: "removed",
  left: "removed",
};

const OFFER_STATUS_ALIASES: Record<string, WaitingListOfferStatus> = {
  pending: "pending",
  active: "pending",
  offered: "pending",
  accepted: "accepted",
  rejected: "rejected",
  expired: "expired",
  slot_taken: "slot_taken",
  taken: "slot_taken",
  unavailable: "slot_taken",
  cancelled: "cancelled",
  canceled: "cancelled",
};

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function moneyLabel(value: unknown, currency?: string): string | undefined {
  if (typeof value === "string") {
    return asSafeText(value);
  }
  if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
    try {
      return new Intl.NumberFormat("fa-IR", {
        style: currency ? "currency" : "decimal",
        currency: currency || "IRR",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return String(value);
    }
  }
  if (!isRecord(value)) {
    return undefined;
  }
  return (
    asSafeText(value.label) ??
    asSafeText(value.formatted) ??
    asSafeText(value.amountLabel) ??
    moneyLabel(value.amount, readString(value.currency) ?? currency)
  );
}

export function parseWaitingListEntryStatus(value: unknown): WaitingListEntryStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  return ENTRY_STATUS_ALIASES[raw] ?? "unknown";
}

export function parseWaitingListOfferStatus(value: unknown): WaitingListOfferStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  return OFFER_STATUS_ALIASES[raw] ?? "unknown";
}

function adaptProviderPreference(root: Record<string, unknown>): ProviderPreference {
  const nested = isRecord(root.providerPreference)
    ? root.providerPreference
    : isRecord(root.provider)
      ? root.provider
      : root;
  const typeRaw = (
    readString(nested.type) ??
    readString(nested.mode) ??
    readString(nested.preference) ??
    readString(root.providerMode)
  )
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (typeRaw === "any" || typeRaw === "no_preference" || typeRaw === "none") {
    return { type: "any" };
  }
  if (typeRaw === "automatic" || typeRaw === "assigned") {
    return { type: "automatic" };
  }
  if (typeRaw === "not_applicable" || typeRaw === "omitted") {
    return { type: "not_applicable" };
  }
  const providerId =
    publicId(nested.providerId) ??
    publicId(nested.staff_preference_id) ??
    publicId(root.staff_preference_id) ??
    publicId(nested.id);
  if (providerId) {
    return { type: "specific", providerId };
  }
  return { type: "any" };
}

function datePreferenceLabel(value: unknown): string | undefined {
  if (!isRecord(value)) {
    const date = readString(value);
    return date ? `تاریخ ${date}` : undefined;
  }
  const mode = readString(value.mode)?.toLowerCase();
  if (mode === "any" || mode === "flexible") {
    return "هر تاریخی";
  }
  if (mode === "specific" || value.date) {
    const date = readString(value.date);
    return date ? `تاریخ ${date}` : undefined;
  }
  if (mode === "range" || (value.from && value.to)) {
    const from = readString(value.from);
    const to = readString(value.to);
    if (from && to) return `از ${from} تا ${to}`;
  }
  if (Array.isArray(value.dates)) {
    const dates = value.dates
      .map((item) => readString(item))
      .filter((item): item is string => Boolean(item));
    if (dates.length) return `تاریخ‌ها: ${dates.join("، ")}`;
  }
  return asSafeText(value.label);
}

function timePreferenceLabel(value: unknown): string | undefined {
  if (typeof value === "string") {
    const key = value.toLowerCase().replace(/[\s-]+/g, "_") as WaitingListTimePreference;
    if (key in WAITING_LIST_TIME_PREFERENCE_LABELS) {
      return WAITING_LIST_TIME_PREFERENCE_LABELS[key];
    }
    return asSafeText(value);
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const mode = (readString(value.mode) ?? readString(value.preference))
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_") as WaitingListTimePreference | undefined;
  if (mode && mode in WAITING_LIST_TIME_PREFERENCE_LABELS) {
    if (mode === "exact") {
      const from = readString(value.from) ?? readString(value.timeFrom);
      const to = readString(value.to) ?? readString(value.timeTo);
      if (from && to) return `${from} تا ${to}`;
    }
    return WAITING_LIST_TIME_PREFERENCE_LABELS[mode];
  }
  return asSafeText(value.label);
}

function adaptOfferSummary(value: unknown): WaitingListOfferSummary | undefined {
  if (!isRecord(value) || isInternalResource(value)) {
    return undefined;
  }
  const publicReference =
    publicId(value.publicReference) ??
    publicId(value.offerReference) ??
    publicId(value.reference) ??
    publicId(value.id);
  if (!publicReference) {
    return undefined;
  }
  const status = parseWaitingListOfferStatus(value.status);
  const summary: WaitingListOfferSummary = { publicReference, status };
  const startsAt = readString(value.startsAt);
  if (startsAt) {
    summary.startsAt = startsAt;
    const when = formatAppointmentParts(startsAt)?.label;
    if (when) summary.whenLabel = when;
  }
  const expiresAt = readString(value.expiresAt);
  if (expiresAt) summary.expiresAt = expiresAt;
  summary.href = `/waiting-list/offers/${publicReference}`;
  return summary;
}

export function adaptWaitingListEntry(value: unknown): WaitingListEntryView | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id =
    publicId(value.publicReference) ??
    publicId(value.entryReference) ??
    publicId(value.reference) ??
    publicId(value.id);
  const serviceSource =
    isRecord(value.service) && !isInternalResource(value.service) ? value.service : undefined;
  const serviceName =
    asSafeText(serviceSource?.name) ??
    asSafeText(serviceSource?.title) ??
    asSafeText(value.serviceName) ??
    (publicId(value.serviceId ?? value.service_id) ? "خدمت" : undefined);
  const createdAt =
    readString(value.createdAt) ??
    readString(value.created_at) ??
    readString(value.joinedAt) ??
    readString(value.joined_at);
  if (!id || !serviceName || !createdAt) {
    return null;
  }
  const status = parseWaitingListEntryStatus(value.status);
  const entry: WaitingListEntryView = {
    id,
    publicReference: publicId(value.publicReference) ?? publicId(value.entryReference) ?? id,
    status,
    statusLabel: WAITING_LIST_ENTRY_STATUS_LABELS[status],
    service: { name: serviceName },
    createdAt,
    canLeave: readBoolean(value.canLeave) ?? (status === "active" || status === "offered"),
    canViewOffer: false,
  };
  const serviceId =
    publicId(serviceSource?.id) ?? publicId(value.serviceId) ?? publicId(value.service_id);
  if (serviceId) entry.service.id = serviceId;
  const preference = adaptProviderPreference(value);
  const providerName =
    asSafeText(isRecord(value.provider) ? value.provider.name : undefined) ??
    asSafeText(value.providerName);
  entry.provider = { preference };
  if (providerName) entry.provider.name = providerName;
  const providerTitle = asSafeText(isRecord(value.provider) ? value.provider.title : undefined);
  if (providerTitle) entry.provider.title = providerTitle;
  const branchSource =
    isRecord(value.branch) && !isInternalResource(value.branch) ? value.branch : undefined;
  const branchName = asSafeText(branchSource?.name) ?? asSafeText(value.branchName);
  if (branchName) {
    entry.branch = { name: branchName };
    const branchId = publicId(branchSource?.id) ?? publicId(value.branchId);
    if (branchId) entry.branch.id = branchId;
  }
  const dateLabel =
    datePreferenceLabel(value.datePreference ?? value.dates ?? value.preferredDate) ??
    asSafeText(value.datePreferenceLabel);
  if (dateLabel) entry.datePreferenceLabel = dateLabel;
  const timeLabel =
    timePreferenceLabel(value.timePreference ?? value.preferredTime) ??
    asSafeText(value.timePreferenceLabel);
  if (timeLabel) entry.timePreferenceLabel = timeLabel;
  const note = asSafeText(value.note) ?? asSafeText(value.customerNote);
  if (note) entry.note = note;
  const createdLabel = formatRelativeTime(createdAt) ?? formatAppointmentParts(createdAt)?.label;
  if (createdLabel) entry.createdLabel = createdLabel;
  const offer = adaptOfferSummary(value.activeOffer ?? value.offer ?? value.currentOffer);
  if (offer) {
    entry.activeOffer = offer;
    entry.canViewOffer = true;
  }
  if (readBoolean(value.canViewOffer) === true) entry.canViewOffer = true;
  return entry;
}

export function adaptWaitingListList(
  payload: unknown,
  page = 1,
): WaitingListListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "entries", "results"])
    .map((item) => adaptWaitingListEntry(item))
    .filter((item): item is WaitingListEntryView => Boolean(item));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const pageNumber = readNumber(source.page) ?? page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const nextCursor = readString(source.nextCursor) ?? readString(source.cursor);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    Boolean(nextCursor) ||
    (typeof pageCount === "number" && pageCount > pageNumber);
  const emptyFlag = readBoolean(source.empty) ?? readBoolean(source.isEmpty);
  return {
    items: unique,
    page: typeof pageNumber === "number" && pageNumber > 0 ? pageNumber : page,
    hasMore,
    empty: emptyFlag === true || unique.length === 0,
    pageCount: typeof pageCount === "number" && pageCount > 0 ? pageCount : undefined,
    nextCursor: nextCursor || undefined,
  };
}

export function adaptWaitingListOffer(payload: unknown): WaitingListOfferView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const id =
    publicId(root.publicReference) ??
    publicId(root.offerReference) ??
    publicId(root.reference) ??
    publicId(root.id);
  const serviceSource =
    isRecord(root.service) && !isInternalResource(root.service) ? root.service : undefined;
  const serviceName =
    asSafeText(serviceSource?.name) ??
    asSafeText(root.serviceName) ??
    asSafeText(root.service_title);
  const startsAt =
    readString(root.startsAt) ??
    readString(root.start_at) ??
    readString(root.slotStartsAt);
  const expiresAt = readString(root.expiresAt) ?? readString(root.expires_at);
  if (!id || !serviceName || !startsAt || !expiresAt) {
    return null;
  }
  const status = parseWaitingListOfferStatus(root.status);
  const whenLabel = formatAppointmentParts(startsAt)?.label ?? startsAt;
  const offer: WaitingListOfferView = {
    id,
    publicReference: publicId(root.publicReference) ?? id,
    status,
    statusLabel: WAITING_LIST_OFFER_STATUS_LABELS[status],
    service: { name: serviceName },
    startsAt,
    whenLabel,
    expiresAt,
    canAccept: readBoolean(root.canAccept) ?? status === "pending",
    canReject: readBoolean(root.canReject) ?? status === "pending",
  };
  const serviceId = publicId(serviceSource?.id) ?? publicId(root.serviceId);
  if (serviceId) offer.service.id = serviceId;
  const entryReference =
    publicId(root.entryReference) ??
    publicId(root.waitingListEntryId) ??
    publicId(root.waiting_list_entry_id);
  if (entryReference) offer.entryReference = entryReference;
  const providerName =
    asSafeText(isRecord(root.provider) ? root.provider.name : undefined) ??
    asSafeText(root.providerName);
  if (providerName) offer.providerName = providerName;
  const branchName =
    asSafeText(isRecord(root.branch) ? root.branch.name : undefined) ??
    asSafeText(root.branchName);
  if (branchName) offer.branchName = branchName;
  const endsAt = readString(root.endsAt);
  if (endsAt) offer.endsAt = endsAt;
  const duration = readNumber(root.durationMinutes) ?? readNumber(root.duration);
  if (typeof duration === "number" && duration > 0) {
    offer.durationMinutes = duration;
    offer.durationLabel = formatDurationMinutes(duration);
  }
  const currency = readString(root.currency);
  const priceLabel = moneyLabel(root.priceLabel ?? root.totalLabel ?? root.amount, currency);
  if (priceLabel) offer.priceLabel = priceLabel;
  const depositLabel = moneyLabel(root.depositLabel ?? root.payableNowLabel, currency);
  if (depositLabel) offer.depositLabel = depositLabel;
  const serverNow = readString(root.serverNow) ?? readString(root.now);
  if (serverNow) offer.serverNow = serverNow;
  const policyWarning =
    asSafeText(root.policyWarning) ??
    asSafeText(root.warning) ??
    asSafeText(root.policySummary);
  if (policyWarning) offer.policyWarning = policyWarning;
  if (readBoolean(root.rejectKeepsEntryActive) !== undefined) {
    offer.rejectKeepsEntryActive = readBoolean(root.rejectKeepsEntryActive);
  }
  if (readBoolean(root.rejectClosesEntry) !== undefined) {
    offer.rejectClosesEntry = readBoolean(root.rejectClosesEntry);
  } else if (offer.rejectKeepsEntryActive === false) {
    offer.rejectClosesEntry = true;
  }
  return offer;
}

export function adaptWaitingListEligibility(payload: unknown): WaitingListEligibilityView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const eligible =
    readBoolean(source.eligible) === true ||
    readBoolean(source.waitingListJoinAllowed) === true ||
    readBoolean(source.canJoin) === true;
  const view: WaitingListEligibilityView = { eligible };
  const reason = asSafeText(source.reason) ?? asSafeText(source.message);
  if (reason) view.reason = reason;
  if (readBoolean(source.serviceSupportsWaitingList) !== undefined) {
    view.serviceSupportsWaitingList = readBoolean(source.serviceSupportsWaitingList);
  }
  if (readBoolean(source.capabilityEnabled) !== undefined) {
    view.capabilityEnabled = readBoolean(source.capabilityEnabled);
  }
  return view;
}

export function adaptWaitingListAcceptOutcome(payload: unknown): WaitingListAcceptOutcome {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { outcome: "unknown", message: "پاسخ پذیرش پیشنهاد قابل استفاده نبود." };
  }
  const raw = (
    readString(root.outcome) ??
    readString(root.result) ??
    readString(root.status)
  )
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  const message = asSafeText(root.message) ?? asSafeText(root.summary);
  const bookingReference =
    publicId(root.bookingReference) ?? publicId(root.appointmentReference);
  const holdReference = publicId(root.holdReference);
  const paymentReference = publicId(root.paymentReference) ?? publicId(root.paymentId);

  if (raw === "confirmed" || raw === "fulfilled" || raw === "booked") {
    if (!bookingReference) {
      return { outcome: "unknown", message: message ?? "مرجع نوبت دریافت نشد." };
    }
    return { outcome: "confirmed", bookingReference, message };
  }
  if (raw === "payment_required" || raw === "requires_payment") {
    return {
      outcome: "payment_required",
      paymentReference,
      holdReference,
      bookingReference,
      message,
    };
  }
  if (raw === "hold_created" || raw === "held") {
    if (!holdReference) {
      return { outcome: "unknown", message: message ?? "مرجع رزرو موقت دریافت نشد." };
    }
    return { outcome: "hold_created", holdReference, message };
  }
  if (raw === "expired" || raw === "offer_expired") {
    return { outcome: "expired", message };
  }
  if (raw === "slot_taken" || raw === "taken" || raw === "unavailable") {
    return { outcome: "slot_taken", message };
  }
  if (raw === "conflict") {
    return { outcome: "conflict", message };
  }
  if (raw === "already_accepted") {
    return { outcome: "already_accepted", bookingReference, message };
  }
  if (raw === "additional_info_required" || raw === "needs_info") {
    return { outcome: "additional_info_required", message };
  }
  // Infer from nested references when outcome omitted.
  if (bookingReference && !paymentReference && !holdReference) {
    return { outcome: "confirmed", bookingReference, message };
  }
  if (holdReference) {
    return { outcome: "hold_created", holdReference, message };
  }
  if (paymentReference) {
    return { outcome: "payment_required", paymentReference, bookingReference, message };
  }
  return { outcome: "unknown", message };
}

export function parseJoinDatePreference(input: {
  mode: string;
  date?: string;
  from?: string;
  to?: string;
  dates?: string[];
}): WaitingListDatePreference | null {
  if (input.mode === "any") return { mode: "any" };
  if (input.mode === "specific" && input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { mode: "specific", date: input.date };
  }
  if (
    input.mode === "range" &&
    input.from &&
    input.to &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.to)
  ) {
    return { mode: "range", from: input.from, to: input.to };
  }
  if (input.mode === "multiple" && input.dates && input.dates.length > 0) {
    const dates = input.dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
    if (dates.length) return { mode: "multiple", dates };
  }
  return null;
}
