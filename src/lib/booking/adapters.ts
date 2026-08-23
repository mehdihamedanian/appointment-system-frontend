import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isInternalResource, readId } from "@/lib/public/adapters";
import { isRecord, readString } from "@/lib/utilities/records";
import { formatAppointmentParts, formatCurrencyAmount } from "@/lib/date-time/format";
import { adaptCoupon, adaptPaymentOptions } from "@/lib/payment/adapter";
import type {
  AdditionalFieldDefinition,
  AdditionalFieldType,
  BookableDatesView,
  BookableSlotsView,
  BookingConfirmView,
  BookingQuoteView,
  CheckoutPath,
  PricingLineView,
  QuotePaymentMode,
  QuotePolicyView,
} from "@/types/booking";
import type {
  AvailableSlotStatus,
  AvailableSlotView,
  BookableDateDay,
  CalendarDayAvailability,
} from "@/types/availability";

const FIELD_TYPES: Record<string, AdditionalFieldType> = {
  text: "text",
  textarea: "textarea",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  date: "date",
};

const CHECKOUT_PATHS: Record<string, CheckoutPath> = {
  confirm: "confirm",
  confirmation: "confirm",
  none: "confirm",
  no_payment: "confirm",
  pay_full: "pay_full",
  full: "pay_full",
  online: "pay_full",
  pay_deposit: "pay_deposit",
  deposit: "pay_deposit",
  pay_at_location: "pay_at_location",
  pay_later: "pay_at_location",
};

const PAYMENT_MODES: Record<string, QuotePaymentMode> = {
  none: "none",
  no_payment: "none",
  confirm: "none",
  full: "full",
  pay_full: "full",
  online: "full",
  deposit: "deposit",
  pay_deposit: "deposit",
  pay_at_location: "pay_at_location",
  pay_later: "pay_at_location",
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function adaptDayStatus(value: unknown): CalendarDayAvailability {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "closed" || raw === "holiday" || raw === "off") {
    return "closed";
  }
  if (raw === "no_capacity" || raw === "full" || raw === "sold_out" || raw === "capacity_full") {
    return "no_capacity";
  }
  if (raw === "available" || raw === "open" || raw === "bookable") {
    return "available";
  }
  return "unavailable";
}

function adaptSlotStatus(value: unknown): AvailableSlotStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "held" || raw === "hold" || raw === "reserved") {
    return "held";
  }
  if (raw === "unavailable" || raw === "taken" || raw === "disabled" || raw === "full") {
    return "unavailable";
  }
  return "available";
}

export function adaptAdditionalFields(payload: unknown): AdditionalFieldDefinition[] {
  const root = unwrapPayload(payload);
  const source = isRecord(root)
    ? (root.additionalFields ?? root.customFields ?? root.bookingFields)
    : undefined;
  return asList(source, ["items", "fields"])
    .map((item) => {
      if (!isRecord(item) || isInternalResource(item)) {
        return null;
      }
      const id = readId(item);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      const type = FIELD_TYPES[readString(item.type)?.toLowerCase() ?? ""];
      if (!id || !label || !type) {
        return null;
      }
      const field: AdditionalFieldDefinition = {
        id,
        label,
        type,
        required: readBoolean(item.required) === true,
        options: asList(item.options, ["items"])
          .map((option) => {
            if (typeof option === "string") {
              const text = asSafeText(option);
              return text && isSafePublicId(text.replace(/\s/g, "_"))
                ? { value: text, label: text }
                : text
                  ? { value: text.slice(0, 80), label: text }
                  : null;
            }
            if (!isRecord(option)) {
              return null;
            }
            const value = readString(option.value) ?? readString(option.id);
            const optionLabel = asSafeText(option.label) ?? value;
            return value && optionLabel ? { value, label: optionLabel } : null;
          })
          .filter((option): option is { value: string; label: string } => Boolean(option)),
        sensitive: readBoolean(item.sensitive) === true || readBoolean(item.medical) === true,
      };
      const helpText = asSafeText(item.helpText) ?? asSafeText(item.description);
      if (helpText) {
        field.helpText = helpText;
      }
      const maxLength = typeof item.maxLength === "number" ? item.maxLength : undefined;
      if (maxLength && maxLength > 0) {
        field.maxLength = Math.min(maxLength, 2000);
      }
      const minLength = typeof item.minLength === "number" ? item.minLength : undefined;
      if (minLength && minLength > 0) {
        field.minLength = minLength;
      }
      const pattern = readString(item.pattern);
      if (pattern && pattern.length < 200) {
        field.pattern = pattern;
      }
      return field;
    })
    .filter((item): item is AdditionalFieldDefinition => Boolean(item));
}

export function adaptBookableDates(payload: unknown): BookableDatesView {
  const root = unwrapPayload(payload);
  if (root == null) {
    return { available: false, dates: [], days: [], unavailableReason: "empty" };
  }
  const items = asList(root, ["dates", "items", "availableDates", "days"]);
  const days: BookableDateDay[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      if (isIsoDate(item)) {
        days.push({ date: item, status: "available" });
      }
      continue;
    }
    if (!isRecord(item) || isInternalResource(item)) {
      continue;
    }
    const iso = readString(item.date) ?? readString(item.isoDate) ?? readId(item);
    if (!iso || !isIsoDate(iso)) {
      continue;
    }
    const explicit = item.status ?? item.availability ?? item.state;
    const status =
      explicit !== undefined
        ? adaptDayStatus(explicit)
        : readBoolean(item.available) === false
          ? "unavailable"
          : "available";
    days.push({ date: iso, status });
  }
  const dates = days.filter((day) => day.status === "available").map((day) => day.date);
  const timezone = isRecord(root) ? readString(root.timezone) : undefined;
  const month = isRecord(root) ? readString(root.month) : undefined;
  const minDate = isRecord(root) ? readString(root.minDate) ?? readString(root.bookingMinDate) : undefined;
  const maxDate = isRecord(root) ? readString(root.maxDate) ?? readString(root.bookingMaxDate) : undefined;
  const serverNow = isRecord(root) ? readString(root.serverNow) ?? readString(root.now) : undefined;
  const view: BookableDatesView = {
    available: dates.length > 0,
    dates,
    days,
    unavailableReason: dates.length === 0 ? "empty" : undefined,
  };
  if (timezone) {
    view.timezone = timezone;
  }
  if (month && isIsoMonth(month)) {
    view.month = month;
  }
  if (minDate && isIsoDate(minDate)) {
    view.minDate = minDate;
  }
  if (maxDate && isIsoDate(maxDate)) {
    view.maxDate = maxDate;
  }
  if (serverNow) {
    view.serverNow = serverNow;
  }
  return view;
}

export function adaptBookableSlots(payload: unknown): BookableSlotsView {
  const root = unwrapPayload(payload);
  const items = asList(root, ["slots", "items", "availableSlots"]);
  const timezone = isRecord(root) ? readString(root.timezone) : undefined;
  const slots: AvailableSlotView[] = [];
  for (const item of items) {
    if (!isRecord(item) || isInternalResource(item)) {
      continue;
    }
    const id = readId(item);
    if (!id) {
      continue;
    }
    const startsAtRaw =
      readString(item.startsAt) ?? readString(item.startAt) ?? readString(item.start);
    const startsAt =
      startsAtRaw && (/^\d{4}-\d{2}-\d{2}T/.test(startsAtRaw) || startsAtRaw.includes("Z"))
        ? startsAtRaw
        : "";
    const label =
      asSafeText(item.label) ??
      asSafeText(item.startLabel) ??
      asSafeText(item.startTime) ??
      asSafeText(item.time) ??
      (startsAtRaw && !startsAt ? asSafeText(startsAtRaw) : undefined) ??
      (startsAt ? formatAppointmentParts(startsAt, timezone)?.time : undefined);
    if (!label) {
      continue;
    }
    const slot: AvailableSlotView = {
      id,
      startsAt,
      label,
      status: adaptSlotStatus(item.status ?? item.availability ?? item.state),
    };
    const endsAt = readString(item.endsAt) ?? readString(item.endAt) ?? readString(item.end);
    if (endsAt) {
      slot.endsAt = endsAt;
    }
    const endLabel = asSafeText(item.endLabel) ?? asSafeText(item.endTime);
    if (!slot.endsAt && endLabel) {
      slot.endsAt = endLabel;
    }
    slots.push(slot);
  }
  const view: BookableSlotsView = {
    available: slots.some((slot) => slot.status === "available"),
    slots,
    timezone,
    unavailableReason: slots.length === 0 ? "empty" : undefined,
  };
  const joinAllowed =
    readBoolean(isRecord(root) ? root.waitingListJoinAllowed : undefined) ??
    readBoolean(isRecord(root) ? root.canJoinWaitingList : undefined);
  if (joinAllowed !== undefined) {
    view.waitingListJoinAllowed = joinAllowed;
  }
  return view;
}

function adaptCheckoutPath(value: unknown): CheckoutPath {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  return (raw && CHECKOUT_PATHS[raw]) || "unknown";
}

function adaptPaymentMode(value: unknown, checkoutPath: CheckoutPath): QuotePaymentMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && PAYMENT_MODES[raw]) {
    return PAYMENT_MODES[raw];
  }
  if (checkoutPath === "confirm") return "none";
  if (checkoutPath === "pay_full") return "full";
  if (checkoutPath === "pay_deposit") return "deposit";
  if (checkoutPath === "pay_at_location") return "pay_at_location";
  return "unknown";
}

function checkoutPathFromMode(mode: QuotePaymentMode): CheckoutPath {
  if (mode === "none") return "confirm";
  if (mode === "full") return "pay_full";
  if (mode === "deposit") return "pay_deposit";
  if (mode === "pay_at_location") return "pay_at_location";
  return "unknown";
}

function adaptMoneyLabel(value: unknown, currency?: string): string | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value === 0) {
      return undefined;
    }
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

function lineKind(value: unknown): PricingLineView["kind"] {
  const raw = readString(value)?.toLowerCase();
  if (raw === "base" || raw === "service") return "base";
  if (raw === "fee" || raw === "surcharge") return "fee";
  if (raw === "discount") return "discount";
  if (raw === "tax") return "tax";
  return "other";
}

function adaptPricingLine(item: unknown, currency?: string, index = 0): PricingLineView | null {
  if (typeof item === "string") {
    const label = asSafeText(item);
    return label ? { id: `line_${index}`, label, amountLabel: label, kind: "other" } : null;
  }
  if (!isRecord(item) || isInternalResource(item)) {
    return null;
  }
  const amountLabel = adaptMoneyLabel(item.amountLabel ?? item.amount ?? item, currency);
  const label = asSafeText(item.label) ?? asSafeText(item.name) ?? asSafeText(item.title);
  if (!label || !amountLabel) {
    return null;
  }
  return {
    id: readId(item) ?? `line_${index}`,
    label,
    amountLabel,
    kind: lineKind(item.kind ?? item.type),
  };
}

function adaptPolicySnapshot(value: unknown, fallbackSummary?: string): QuotePolicyView | undefined {
  const source = isRecord(value) ? value : fallbackSummary ? { summary: fallbackSummary } : null;
  if (!source) {
    return undefined;
  }
  const snapshot: QuotePolicyView = {
    consentRequired: readBoolean(source.consentRequired) === true || readBoolean(source.requiresConsent) === true,
  };
  const summary = asSafeText(source.summary) ?? asSafeText(source.shortText) ?? fallbackSummary;
  if (summary) snapshot.summary = summary;
  const fullText = asSafeText(source.fullText) ?? asSafeText(source.text) ?? asSafeText(source.body);
  if (fullText) snapshot.fullText = fullText;
  const reschedule = asSafeText(source.rescheduleSummary) ?? asSafeText(source.reschedulePolicy);
  if (reschedule) snapshot.rescheduleSummary = reschedule;
  const refundability = asSafeText(source.refundability) ?? asSafeText(source.refundPolicy);
  if (refundability) snapshot.refundability = refundability;
  const consentLabel = asSafeText(source.consentLabel);
  if (consentLabel) snapshot.consentLabel = consentLabel;
  if (!snapshot.summary && !snapshot.fullText && !snapshot.consentRequired) {
    return undefined;
  }
  return snapshot;
}

export function emptyBookingQuote(): BookingQuoteView {
  return {
    lines: [],
    paymentMode: "unknown",
    checkoutPath: "unknown",
    paymentOptions: [],
    changed: false,
    policyChanged: false,
    authoritative: false,
  };
}

export function adaptBookingQuote(payload: unknown): BookingQuoteView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return emptyBookingQuote();
  }
  const pricingRoot = isRecord(root.pricing) ? root.pricing : root;
  const currency = readString(pricingRoot.currency) ?? readString(root.currency);
  const checkoutPathHint = adaptCheckoutPath(
    root.checkoutPath ?? root.paymentPath ?? root.confirmationMode ?? root.paymentMode,
  );
  const paymentMode = adaptPaymentMode(root.paymentMode ?? root.paymentRequirement, checkoutPathHint);
  const checkoutPath =
    checkoutPathHint === "unknown" ? checkoutPathFromMode(paymentMode) : checkoutPathHint;

  const quote: BookingQuoteView = {
    lines: [],
    paymentMode,
    checkoutPath,
    paymentOptions: [],
    changed:
      readBoolean(root.changed) === true ||
      readBoolean(root.priceChanged) === true ||
      readBoolean(root.stale) === true,
    policyChanged: readBoolean(root.policyChanged) === true,
    authoritative: true,
  };
  const id = readId(root) ?? readId(isRecord(root.quote) ? root.quote : undefined);
  if (id) quote.id = id;
  if (currency) quote.currency = currency;
  const expiresAt = readString(root.expiresAt) ?? readString(root.quoteExpiresAt);
  if (expiresAt) quote.expiresAt = expiresAt;
  const serverNow = readString(root.serverNow) ?? readString(root.now);
  if (serverNow) quote.serverNow = serverNow;
  const timezone = readString(root.timezone);
  if (timezone) quote.timezone = timezone;

  const priceLabel =
    adaptMoneyLabel(pricingRoot.baseAmount ?? pricingRoot.priceLabel ?? root.priceLabel ?? root.amountLabel, currency);
  if (priceLabel) quote.priceLabel = priceLabel;
  const depositLabel = adaptMoneyLabel(pricingRoot.depositAmount ?? root.depositLabel, currency);
  if (depositLabel) quote.depositLabel = depositLabel;
  const discountLabel = adaptMoneyLabel(pricingRoot.discountAmount ?? root.discountLabel, currency);
  if (discountLabel) quote.discountLabel = discountLabel;
  const taxLabel = adaptMoneyLabel(pricingRoot.taxAmount ?? root.taxLabel, currency);
  if (taxLabel) quote.taxLabel = taxLabel;
  const totalLabel = adaptMoneyLabel(
    pricingRoot.totalAmount ?? root.finalAmountLabel ?? root.totalLabel,
    currency,
  );
  if (totalLabel) quote.finalAmountLabel = totalLabel;
  const payableNowLabel = adaptMoneyLabel(
    pricingRoot.payableNow ?? root.payableNowLabel ?? root.payableLabel,
    currency,
  );
  if (payableNowLabel) quote.payableNowLabel = payableNowLabel;
  const payableLater = adaptMoneyLabel(
    pricingRoot.payableAtLocation ?? pricingRoot.remainingAmount ?? root.payableAtLocationLabel,
    currency,
  );
  if (payableLater) quote.payableAtLocationLabel = payableLater;

  const lineItems = asList(pricingRoot.lines ?? pricingRoot.fees ?? root.lines, ["items"]);
  quote.lines = lineItems
    .map((item, index) => adaptPricingLine(item, currency, index))
    .filter((item): item is PricingLineView => Boolean(item));
  if (priceLabel && !quote.lines.some((line) => line.kind === "base")) {
    quote.lines.unshift({ id: "base", label: "مبلغ خدمت", amountLabel: priceLabel, kind: "base" });
  }
  if (discountLabel && !quote.lines.some((line) => line.kind === "discount")) {
    quote.lines.push({ id: "discount", label: "تخفیف", amountLabel: discountLabel, kind: "discount" });
  }
  if (taxLabel && !quote.lines.some((line) => line.kind === "tax")) {
    quote.lines.push({ id: "tax", label: "مالیات", amountLabel: taxLabel, kind: "tax" });
  }

  if (typeof root.durationMinutes === "number" && Number.isInteger(root.durationMinutes)) {
    quote.durationMinutes = root.durationMinutes;
  }
  const policyText = asSafeText(root.policy) ?? asSafeText(root.cancellationPolicy);
  if (policyText) quote.policy = policyText;
  const policySnapshot = adaptPolicySnapshot(root.cancellationPolicy ?? root.policySnapshot ?? root.policy, policyText);
  if (policySnapshot) quote.policySnapshot = policySnapshot;

  const serviceSource = isRecord(root.service) ? root.service : undefined;
  if (serviceSource && !isInternalResource(serviceSource)) {
    const name = asSafeText(serviceSource.name) ?? asSafeText(serviceSource.title);
    if (name) {
      quote.service = { name };
      if (typeof serviceSource.durationMinutes === "number" && Number.isInteger(serviceSource.durationMinutes)) {
        quote.service.durationMinutes = serviceSource.durationMinutes;
      }
      const imageUrl = readString(serviceSource.imageUrl);
      if (imageUrl) quote.service.imageUrl = imageUrl;
      const shortDescription = asSafeText(serviceSource.shortDescription);
      if (shortDescription) quote.service.shortDescription = shortDescription;
    }
  }

  const providerSource = isRecord(root.provider) ? root.provider : undefined;
  if (providerSource && !isInternalResource(providerSource)) {
    const modeRaw = readString(providerSource.mode) ?? readString(providerSource.assignment);
    quote.provider = {
      mode:
        modeRaw === "any" || modeRaw === "automatic" || modeRaw === "not_applicable" || modeRaw === "specific"
          ? modeRaw
          : "specific",
      name: asSafeText(providerSource.name) ?? asSafeText(providerSource.displayName),
      title: asSafeText(providerSource.title) ?? asSafeText(providerSource.publicTitle),
    };
  }

  const branchSource = isRecord(root.branch) ? root.branch : undefined;
  if (branchSource && !isInternalResource(branchSource)) {
    const name = asSafeText(branchSource.name);
    if (name) {
      quote.branch = { name, address: asSafeText(branchSource.address) };
    }
  }

  const slotSource = isRecord(root.slot) ? root.slot : undefined;
  if (slotSource && !isInternalResource(slotSource)) {
    quote.slot = {
      id: readId(slotSource),
      startsAt: readString(slotSource.startsAt),
      endsAt: readString(slotSource.endsAt),
      label: asSafeText(slotSource.label) ?? asSafeText(slotSource.startLabel),
    };
  }

  quote.paymentOptions = adaptPaymentOptions(quote, root);
  const coupon = adaptCoupon(root);
  if (coupon) quote.coupon = coupon;

  return quote;
}

export function adaptBookingConfirm(payload: unknown): BookingConfirmView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { outcome: "missing_endpoint" };
  }
  const status = readString(root.status ?? root.outcome ?? root.result)?.toLowerCase().replace(/[\s-]+/g, "_");
  const quote =
    root.quote !== undefined || root.changed === true ? adaptBookingQuote(root.quote ?? root) : undefined;
  if (quote?.changed || status === "quote_changed" || status === "price_changed") {
    return { outcome: "quote_changed", quote };
  }
  const bookingId = readId(root) ?? readString(root.bookingId) ?? readString(root.appointmentId);
  const reference = asSafeText(root.reference) ?? (bookingId && isSafePublicId(bookingId) ? bookingId : undefined);
  const holdId = readString(root.holdId);
  const paymentRequired =
    status === "payment_required" ||
    status === "held" ||
    quote?.paymentMode === "full" ||
    quote?.paymentMode === "deposit";
  const view: BookingConfirmView = {
    outcome: paymentRequired ? (status === "held" ? "held" : "payment_required") : "confirmed",
  };
  if (status === "held") view.outcome = "held";
  if (status === "confirmed" || status === "booked" || status === "created") view.outcome = "confirmed";
  if (bookingId && isSafePublicId(bookingId)) view.bookingId = bookingId;
  if (reference && isSafePublicId(reference)) view.reference = reference;
  if (holdId && isSafePublicId(holdId)) view.holdId = holdId;
  if (quote) view.quote = quote;
  return view;
}

export function providerQueryKey(preference: { type: string; providerId?: string }): string {
  if (preference.type === "specific" && preference.providerId) {
    return `specific:${preference.providerId}`;
  }
  return preference.type;
}
