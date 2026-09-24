import { maskPhone } from "@/lib/auth/phone";
import { adaptBookingQuote } from "@/lib/booking/adapters";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isInternalResource, readId } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  AdminManualBookingConfirmView,
  AdminManualBookingCreateCustomerResult,
  AdminManualBookingCustomerSearchView,
  AdminManualBookingCustomerView,
  AdminManualBookingOptionsView,
  AdminManualBookingQuoteView,
  AdminManualPaymentMethodType,
  AdminManualPaymentOptionView,
  AdminResourceAllocationGroupView,
  AdminResourceAllocationItemView,
  AdminResourceAllocationView,
} from "@/types/admin-manual-booking";

const PAYMENT_METHOD_COPY: Record<AdminManualPaymentMethodType, { title: string; description: string }> = {
  full: { title: "پرداخت کامل", description: "مبلغ کامل طبق استعلام سرویس ثبت می‌شود." },
  deposit: { title: "پرداخت بیعانه", description: "بیعانه اکنون ثبت می‌شود و مانده در محل دریافت می‌گردد." },
  pay_at_location: { title: "پرداخت در محل", description: "نوبت ثبت می‌شود و مبلغ هنگام مراجعه دریافت می‌شود." },
  cash: { title: "نقدی", description: "پرداخت نقدی در پذیرش ثبت می‌شود." },
  pos: { title: "کارتخوان", description: "پرداخت با کارتخوان در پذیرش ثبت می‌شود." },
  bank_transfer: { title: "انتقال بانکی", description: "پرداخت با انتقال بانکی ثبت می‌شود." },
  recorded: { title: "ثبت پرداخت", description: "اطلاعات پرداخت طبق سیاست مجموعه ثبت می‌شود." },
  none: { title: "بدون پرداخت", description: "نوبت بدون ثبت پرداخت ایجاد می‌شود." },
};

const RESOURCE_KINDS = new Set([
  "staff",
  "room",
  "device",
  "chair",
  "desk",
  "bed",
  "equipment",
  "other",
]);

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) ? raw : undefined;
}

function adaptResourceKind(value: unknown): AdminResourceAllocationItemView["kind"] {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && RESOURCE_KINDS.has(raw)) {
    return raw as AdminResourceAllocationItemView["kind"];
  }
  return "other";
}

function adaptPaymentMethodType(value: unknown): AdminManualPaymentMethodType | undefined {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;
  const map: Record<string, AdminManualPaymentMethodType> = {
    full: "full",
    pay_full: "full",
    online: "full",
    deposit: "deposit",
    pay_deposit: "deposit",
    pay_at_location: "pay_at_location",
    pay_later: "pay_at_location",
    cash: "cash",
    pos: "pos",
    card: "pos",
    bank_transfer: "bank_transfer",
    transfer: "bank_transfer",
    recorded: "recorded",
    none: "none",
    no_payment: "none",
  };
  return map[raw];
}

export function adaptAdminManualPaymentOptions(
  payload: unknown,
  quote?: Omit<AdminManualBookingQuoteView, "paymentOptions"> & {
    paymentOptions?: AdminManualPaymentOptionView[];
  },
): AdminManualPaymentOptionView[] {
  const root = isRecord(payload) ? payload : undefined;
  const list = root && Array.isArray(root.paymentMethods)
    ? root.paymentMethods
    : root && Array.isArray(root.paymentOptions)
      ? root.paymentOptions
      : quote?.paymentOptions;
  if (Array.isArray(list)) {
    const mapped = list
      .map((item): AdminManualPaymentOptionView | undefined => {
        if (!isRecord(item) || isInternalResource(item)) return undefined;
        const type = adaptPaymentMethodType(item.type ?? item.method ?? item.id);
        if (!type) return undefined;
        const copy = PAYMENT_METHOD_COPY[type];
        const option: AdminManualPaymentOptionView = {
          type,
          title: asSafeText(item.title) ?? copy.title,
          description: asSafeText(item.description) ?? copy.description,
        };
        const payable = asSafeText(item.payableNowLabel) ?? asSafeText(item.payableNow);
        if (payable) option.payableNowLabel = payable;
        const remaining = asSafeText(item.remainingAtLocationLabel) ?? asSafeText(item.remainingAmount);
        if (remaining) {
          option.remainingAtLocationLabel = remaining;
          option.remainingDueLabel = asSafeText(item.remainingDueLabel) ?? "مانده هنگام مراجعه پرداخت می‌شود.";
        }
        return option;
      })
      .filter((item): item is AdminManualPaymentOptionView => Boolean(item));
    if (mapped.length > 0) return mapped;
  }
  if (quote?.paymentMode === "full" || quote?.paymentMode === "deposit" || quote?.paymentMode === "pay_at_location") {
    const copy = PAYMENT_METHOD_COPY[quote.paymentMode];
    return [{
      type: quote.paymentMode,
      title: copy.title,
      description: copy.description,
      payableNowLabel: quote.payableNowLabel,
      remainingAtLocationLabel: quote.payableAtLocationLabel,
    }];
  }
  return [];
}

function adaptBookingSources(payload: unknown): AdminManualBookingOptionsView["bookingSources"] {
  const root = isRecord(payload) ? payload : undefined;
  const list = root
    ? asList(root.bookingSources ?? root.sources, ["items", "options"])
    : [];
  return list
    .map((item) => {
      if (!isRecord(item)) return null;
      const value = readString(item.value) ?? readString(item.id);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      if (!value || !label) return null;
      return { value, label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
}

export function adaptAdminManualBookingOptions(payload: unknown): AdminManualBookingOptionsView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const bookingSources = adaptBookingSources(source);
  const defaultBookingSource =
    readString(source.defaultBookingSource) ?? readString(source.defaultSource);
  return {
    bookingSources,
    defaultBookingSource: defaultBookingSource ?? undefined,
  };
}

export function adaptCustomerItem(value: unknown): AdminManualBookingCustomerView | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const id = publicId(value.id) ?? publicId(value.customerId);
  const displayName =
    asSafeText(value.displayName) ??
    asSafeText(value.name) ??
    [asSafeText(value.firstName), asSafeText(value.lastName)].filter(Boolean).join(" ");
  if (!id || !displayName) return null;

  const phone = readString(value.phone) ?? readString(value.mobile);
  const email = readString(value.email);
  const canViewContact =
    readBoolean(value.canViewContact) !== false &&
    (Boolean(phone) || Boolean(email) || Boolean(value.phoneMasked) || Boolean(value.emailMasked));

  const view: AdminManualBookingCustomerView = {
    id,
    displayName,
    canViewContact,
  };
  const reference = readString(value.reference) ?? readString(value.customerReference);
  if (reference) view.reference = reference;
  if (canViewContact && phone) {
    view.phone = phone;
    view.phoneMasked = asSafeText(value.phoneMasked) ?? maskPhone(phone);
  } else if (value.phoneMasked) {
    view.phoneMasked = asSafeText(value.phoneMasked);
  }
  if (canViewContact && email) {
    view.email = email;
    view.emailMasked = asSafeText(value.emailMasked) ?? email;
  } else if (value.emailMasked) {
    view.emailMasked = asSafeText(value.emailMasked);
  }
  return view;
}

export function adaptAdminCustomerSearch(payload: unknown, query: string): AdminManualBookingCustomerSearchView {
  const root = unwrapPayload(payload);
  const items = asList(root, ["items", "results", "customers"])
    .map((item) => adaptCustomerItem(item))
    .filter((item): item is AdminManualBookingCustomerView => Boolean(item));
  return { items, query, empty: items.length === 0 };
}

export function adaptAdminCreateCustomerResult(payload: unknown): AdminManualBookingCreateCustomerResult {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { outcome: "missing_endpoint" };
  }
  const existing = adaptCustomerItem(root.existingCustomer ?? root.customer ?? root.match);
  if (existing && (readBoolean(root.duplicate) === true || readString(root.outcome) === "duplicate")) {
    return {
      outcome: "duplicate",
      customer: existing,
      message: asSafeText(root.message),
    };
  }
  const created = adaptCustomerItem(root.customer ?? root);
  if (created) {
    return { outcome: "created", customer: created };
  }
  return { outcome: "missing_endpoint" };
}

function adaptAllocationItem(value: unknown): AdminResourceAllocationItemView | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const id = readId(value) ?? publicId(value.id);
  const name = asSafeText(value.name) ?? asSafeText(value.label);
  if (!id || !name) return null;
  return {
    id,
    name,
    kind: adaptResourceKind(value.kind ?? value.type ?? value.resourceType),
    required: readBoolean(value.required) === true,
  };
}

function adaptAllocationGroup(value: unknown): AdminResourceAllocationGroupView | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const id = readId(value) ?? publicId(value.id) ?? publicId(value.groupId);
  const label = asSafeText(value.label) ?? asSafeText(value.name) ?? "منابع";
  if (!id) return null;
  const modeRaw = readString(value.mode)?.toLowerCase();
  const mode =
    modeRaw === "override" ? "override" : modeRaw === "select" ? "select" : "automatic";
  const items = asList(value.items ?? value.resources ?? value.options, ["items", "resources"])
    .map((item) => adaptAllocationItem(item))
    .filter((item): item is AdminResourceAllocationItemView => Boolean(item));
  const selectedIds = asList(value.selectedIds ?? value.selected, ["items"])
    .map((item) => readString(item) ?? publicId(item))
    .filter((item): item is string => Boolean(item));
  return { id, label, mode, items, selectedIds: selectedIds.length ? selectedIds : undefined };
}

export function adaptAdminResourceAllocation(payload: unknown): AdminResourceAllocationView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { mode: "automatic", groups: [], canOverride: false, unavailableReason: "missing_endpoint" };
  }
  const allocation = isRecord(root.allocation) ? root.allocation : root;
  const modeRaw = readString(allocation.mode)?.toLowerCase();
  const mode =
    modeRaw === "override" ? "override" : modeRaw === "select" ? "select" : "automatic";
  const groups = asList(allocation.groups ?? allocation.resources, ["items", "groups"])
    .map((item) => adaptAllocationGroup(item))
    .filter((item): item is AdminResourceAllocationGroupView => Boolean(item));
  const canOverride = readBoolean(allocation.canOverride) === true || mode === "override";
  if (readBoolean(allocation.notRequired) === true || groups.length === 0) {
    return {
      mode: "automatic",
      groups: [],
      canOverride: false,
      automaticSummary: asSafeText(allocation.automaticSummary) ?? asSafeText(allocation.summary),
      unavailableReason: "not_required",
    };
  }
  return {
    mode,
    groups,
    canOverride,
    automaticSummary: asSafeText(allocation.automaticSummary) ?? asSafeText(allocation.summary),
  };
}

export function adaptAdminManualBookingQuote(payload: unknown): AdminManualBookingQuoteView {
  const base = adaptBookingQuote(payload);
  const quote: AdminManualBookingQuoteView = {
    ...base,
    paymentOptions: adaptAdminManualPaymentOptions(payload, base),
  };
  const root = unwrapPayload(payload);
  if (isRecord(root)) {
    quote.allocation = adaptAdminResourceAllocation(root);
    const sources = adaptBookingSources(root);
    if (sources.length) quote.bookingSources = sources;
  }
  return quote;
}

export function adaptAdminManualBookingConfirm(payload: unknown): AdminManualBookingConfirmView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { outcome: "missing_endpoint" };
  }
  const outcomeRaw = readString(root.outcome)?.toLowerCase();
  if (outcomeRaw === "quote_changed" || readBoolean(root.quoteChanged) === true) {
    return {
      outcome: "quote_changed",
      quote: adaptAdminManualBookingQuote(root.quote ?? root),
    };
  }
  const reference =
    readString(root.reference) ??
    readString(root.appointmentReference) ??
    publicId(root.id);
  const appointmentId = publicId(root.appointmentId) ?? reference;
  if (!reference) {
    return { outcome: "missing_endpoint" };
  }
  return {
    outcome: "confirmed",
    reference,
    appointmentId,
    paymentStatus: readString(root.paymentStatus),
    paymentStatusLabel: asSafeText(root.paymentStatusLabel) ?? asSafeText(root.paymentStatus),
    allocationSummary: asSafeText(root.allocationSummary) ?? asSafeText(root.resourceSummary),
    quote: root.quote ? adaptAdminManualBookingQuote(root.quote) : undefined,
  };
}

export function isDuplicateCustomerError(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("DUPLICATE") || code.includes("EXISTS") || code.includes("ALREADY");
}

export function isResourceConflictError(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("RESOURCE") && (code.includes("CONFLICT") || code.includes("UNAVAILABLE"));
}
