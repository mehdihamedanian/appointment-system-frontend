import {
  adminWaitingListDetailHref,
  adminWaitingListFiltersApplied,
  adminWaitingListOfferHref,
} from "@/lib/admin/waiting-list-filters";
import {
  adaptWaitingListEntry,
  parseWaitingListEntryStatus,
  parseWaitingListOfferStatus,
} from "@/lib/customer/waiting-list-adapter";
import { formatAppointmentParts, formatRelativeTime } from "@/lib/date-time/format";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import {
  WAITING_LIST_OFFER_STATUS_LABELS,
} from "@/types/waiting-list";
import type {
  AdminWaitingListAllowedActions,
  AdminWaitingListAvailabilityDay,
  AdminWaitingListAvailabilitySlot,
  AdminWaitingListCapabilities,
  AdminWaitingListCustomerSummary,
  AdminWaitingListDetailView,
  AdminWaitingListDuplicateCheck,
  AdminWaitingListFilterOptions,
  AdminWaitingListImpactPreview,
  AdminWaitingListListFilters,
  AdminWaitingListListItemView,
  AdminWaitingListListView,
  AdminWaitingListManualEntryInput,
  AdminWaitingListManualEntryErrors,
  AdminWaitingListNotificationStatus,
  AdminWaitingListOfferEligibility,
  AdminWaitingListOfferExpirationOption,
  AdminWaitingListOfferHistoryItem,
  AdminWaitingListOfferPreview,
  AdminWaitingListOfferSendResult,
} from "@/types/admin-waiting-list";
import type { ProviderPreference } from "@/types/provider";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) && !/^\d+$/.test(raw) ? raw : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function adaptAllowedActions(value: unknown): AdminWaitingListAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    view: readBoolean(source.view) !== false,
    viewContact: readBoolean(source.viewContact) === true,
    create: readBoolean(source.create) === true,
    sendOffer: readBoolean(source.sendOffer) === true,
    remove: readBoolean(source.remove) === true,
    cancel: readBoolean(source.cancel) === true,
    close: readBoolean(source.close) === true,
    viewOfferHistory: readBoolean(source.viewOfferHistory) !== false,
    viewNotifications: readBoolean(source.viewNotifications) !== false,
    retryNotification: readBoolean(source.retryNotification) === true,
    editNotes: readBoolean(source.editNotes) === true,
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminWaitingListCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsDuplicateCheck: readBoolean(source.supportsDuplicateCheck) !== false,
    supportsManualEntry: readBoolean(source.supportsManualEntry) !== false,
    supportsWaitingListAvailability:
      readBoolean(source.supportsWaitingListAvailability) !== false,
    supportsNotificationRetry: readBoolean(source.supportsNotificationRetry) === true,
  };
}

function adaptCustomer(value: unknown): AdminWaitingListCustomerSummary | undefined {
  if (!isRecord(value) || isInternalResource(value)) return undefined;
  const reference =
    publicId(value.reference) ?? publicId(value.customerReference) ?? publicId(value.id);
  const displayName =
    asSafeText(value.displayName) ??
    asSafeText(value.name) ??
    asSafeText(value.fullName);
  if (!reference || !displayName) return undefined;
  const customer: AdminWaitingListCustomerSummary = {
    reference,
    displayName,
    href: routes.admin.customerDetail(reference),
  };
  const phoneMasked = asSafeText(value.phoneMasked) ?? asSafeText(value.phone);
  if (phoneMasked) customer.phoneMasked = phoneMasked;
  const emailMasked = asSafeText(value.emailMasked) ?? asSafeText(value.email);
  if (emailMasked) customer.emailMasked = emailMasked;
  return customer;
}

function adaptNotification(value: unknown): AdminWaitingListNotificationStatus | undefined {
  if (!isRecord(value)) return undefined;
  const raw = readString(value.state ?? value.status)?.toLowerCase();
  let state: AdminWaitingListNotificationStatus["state"] = "unknown";
  if (raw === "pending" || raw === "queued") state = "pending";
  else if (raw === "sent") state = "sent";
  else if (raw === "delivered") state = "delivered";
  else if (raw === "failed") state = "failed";
  else if (raw === "not_requested" || raw === "none") state = "not_requested";

  const notification: AdminWaitingListNotificationStatus = {
    state,
    stateLabel: asSafeText(value.stateLabel) ?? asSafeText(value.label) ?? "نامشخص",
  };
  const channelLabel = asSafeText(value.channelLabel ?? value.channel);
  if (channelLabel) notification.channelLabel = channelLabel;
  const lastAttemptLabel = asSafeText(value.lastAttemptLabel ?? value.sentAtLabel);
  if (lastAttemptLabel) notification.lastAttemptLabel = lastAttemptLabel;
  const failureReason = asSafeText(value.failureReason ?? value.error);
  if (failureReason) notification.failureReason = failureReason;
  if (readBoolean(value.canRetry) === true) notification.canRetry = true;
  return notification;
}

function adaptOfferHistory(value: unknown): AdminWaitingListOfferHistoryItem[] {
  return asList(value, ["offerHistory", "history", "offers"]).map((entry, index) => {
    if (!isRecord(entry) || isInternalResource(entry)) return null;
    const publicReference =
      publicId(entry.publicReference) ??
      publicId(entry.offerReference) ??
      publicId(entry.reference) ??
      publicId(entry.id);
    if (!publicReference) return null;
    const status = parseWaitingListOfferStatus(entry.status);
    const item: AdminWaitingListOfferHistoryItem = {
      id: readString(entry.id) ?? `offer-${index}`,
      publicReference,
      status,
      statusLabel: WAITING_LIST_OFFER_STATUS_LABELS[status],
    };
    const whenLabel =
      asSafeText(entry.whenLabel) ??
      (readString(entry.startsAt)
        ? formatAppointmentParts(readString(entry.startsAt)!)?.label
        : undefined);
    if (whenLabel) item.whenLabel = whenLabel;
    const expiresAtLabel = asSafeText(entry.expiresAtLabel);
    if (expiresAtLabel) item.expiresAtLabel = expiresAtLabel;
    const createdAtLabel = asSafeText(entry.createdAtLabel ?? entry.sentAtLabel);
    if (createdAtLabel) item.createdAtLabel = createdAtLabel;
    const sentByLabel = asSafeText(entry.sentByLabel ?? entry.authorLabel);
    if (sentByLabel) item.sentByLabel = sentByLabel;
    item.href = adminWaitingListOfferHref(publicReference);
    return item;
  }).filter((item): item is AdminWaitingListOfferHistoryItem => Boolean(item));
}

function providerLabelFromEntry(entry: NonNullable<ReturnType<typeof adaptWaitingListEntry>>): string | undefined {
  if (entry.provider?.name) return entry.provider.name;
  if (entry.provider?.title) return entry.provider.title;
  if (entry.provider?.preference.type === "any") return "بدون ترجیح";
  if (entry.provider?.preference.type === "automatic") return "تخصیص خودکار";
  return undefined;
}

function adaptFilterOptions(value: unknown): AdminWaitingListFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminWaitingListFilterOptions = {};
  const mapOptions = (key: string) =>
    asList(value, [key]).map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.reference);
      const name = asSafeText(item.name);
      return id && name ? { id, name } : null;
    }).filter((item): item is { id: string; name: string } => Boolean(item));

  const services = mapOptions("services");
  if (services.length) options.services = services;
  const providers = mapOptions("providers");
  if (providers.length) options.providers = providers;
  const branches = mapOptions("branches");
  if (branches.length) options.branches = branches;
  return Object.keys(options).length > 0 ? options : undefined;
}

export function adaptAdminWaitingListListItem(value: unknown): AdminWaitingListListItemView | null {
  if (!isRecord(value) || isInternalResource(value)) return null;
  const entry = adaptWaitingListEntry(value);
  if (!entry) return null;

  const customer =
    adaptCustomer(value.customer) ??
    ({
      reference: publicId(value.customerReference) ?? entry.id,
      displayName: asSafeText(value.customerName) ?? "مشتری",
    } as AdminWaitingListCustomerSummary);

  const allowedActions = adaptAllowedActions(value.allowedActions);
  const reference = entry.publicReference;
  const offerStatus = entry.activeOffer?.status;
  const item: AdminWaitingListListItemView = {
    reference,
    customer,
    serviceName: entry.service.name,
    entryStatus: entry.status,
    entryStatusLabel: entry.statusLabel,
    detailHref: adminWaitingListDetailHref(reference),
    canViewDetail: allowedActions.view !== false,
    canSendOffer: allowedActions.sendOffer === true,
  };

  const providerLabel =
    providerLabelFromEntry(entry) ?? asSafeText(value.providerLabel);
  if (providerLabel) item.providerLabel = providerLabel;
  if (entry.branch?.name) item.branchName = entry.branch.name;
  if (entry.datePreferenceLabel) item.datePreferenceLabel = entry.datePreferenceLabel;
  if (entry.timePreferenceLabel) item.timePreferenceLabel = entry.timePreferenceLabel;
  if (entry.createdLabel) item.createdAtLabel = entry.createdLabel;

  if (offerStatus) {
    item.offerStatus = offerStatus;
    item.offerStatusLabel = WAITING_LIST_OFFER_STATUS_LABELS[offerStatus];
  } else {
    const separateOfferStatus = parseWaitingListOfferStatus(
      value.offerStatus ?? value.activeOfferStatus,
    );
    if (separateOfferStatus !== "unknown") {
      item.offerStatus = separateOfferStatus;
      item.offerStatusLabel = WAITING_LIST_OFFER_STATUS_LABELS[separateOfferStatus];
    }
  }

  if (entry.activeOffer?.expiresAt) item.offerExpiresAt = entry.activeOffer.expiresAt;
  const serverNow = readString(value.serverNow) ?? readString(value.offerServerNow);
  if (serverNow) item.offerServerNow = serverNow;
  if (allowedActions.sendOffer) {
    item.offerHref = adminWaitingListOfferHref(reference);
  }
  return item;
}

export function adaptAdminWaitingListList(
  payload: unknown,
  filters: AdminWaitingListListFilters,
): AdminWaitingListListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "entries", "results"])
    .map((item) => adaptAdminWaitingListListItem(item))
    .filter((item): item is AdminWaitingListListItemView => Boolean(item));

  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof pageCount === "number" && typeof page === "number" && pageCount > page);
  const filtersOn = adminWaitingListFiltersApplied(filters);
  const emptyHistoryFlag = readBoolean(source.emptyHistory) ?? readBoolean(source.isEmpty);
  const emptyHistory =
    emptyHistoryFlag === true ||
    (!filtersOn && items.length === 0 && (totalCount === 0 || totalCount === undefined));

  return {
    items,
    page: typeof page === "number" && page > 0 ? page : filters.page,
    hasMore,
    emptyHistory,
    filtersApplied: filtersOn,
    ...(typeof pageCount === "number" && pageCount > 0 ? { pageCount } : {}),
    ...(typeof totalCount === "number" && totalCount >= 0 ? { totalCount } : {}),
    ...(adaptFilterOptions(source.filterOptions ?? source.filters)
      ? { filterOptions: adaptFilterOptions(source.filterOptions ?? source.filters) }
      : {}),
  };
}

export function adaptAdminWaitingListDetail(payload: unknown): AdminWaitingListDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) return null;
  const entry = adaptWaitingListEntry(root);
  if (!entry) return null;

  const customer =
    adaptCustomer(root.customer) ??
    ({
      reference: publicId(root.customerReference) ?? entry.id,
      displayName: asSafeText(root.customerName) ?? "مشتری",
    } as AdminWaitingListCustomerSummary);

  const allowedActions = adaptAllowedActions(root.allowedActions);
  const detail: AdminWaitingListDetailView = {
    reference: entry.publicReference,
    customer,
    serviceName: entry.service.name,
    internalNotes: [],
    offerHistory: adaptOfferHistory(root),
    entryStatus: entry.status,
    entryStatusLabel: entry.statusLabel,
    allowedActions,
    capabilities: adaptCapabilities(root.capabilities),
  };

  if (entry.service.id) detail.serviceId = entry.service.id;
  const providerLabel = providerLabelFromEntry(entry) ?? asSafeText(root.providerLabel);
  if (providerLabel) detail.providerLabel = providerLabel;
  if (entry.branch?.name) detail.branchName = entry.branch.name;
  if (entry.branch?.id) detail.branchId = entry.branch.id;
  if (entry.datePreferenceLabel) detail.datePreferenceLabel = entry.datePreferenceLabel;
  if (entry.timePreferenceLabel) detail.timePreferenceLabel = entry.timePreferenceLabel;
  if (entry.note) detail.customerNote = entry.note;

  if (allowedActions.viewContact) {
    const contactPhone = asSafeText(root.contactPhone ?? root.customerPhone);
    if (contactPhone) detail.contactPhone = contactPhone;
    const contactEmail = asSafeText(root.contactEmail ?? root.customerEmail);
    if (contactEmail) detail.contactEmail = contactEmail;
  }

  const internalNotes = asList(root, ["internalNotes", "adminNotes"]).map((note, index) => {
    if (!isRecord(note)) return null;
    const body = asSafeText(note.body) ?? asSafeText(note.text);
    if (!body) return null;
    return {
      id: readString(note.id) ?? `note-${index}`,
      body,
      authorLabel: asSafeText(note.authorLabel),
      createdAtLabel: asSafeText(note.createdAtLabel),
    };
  }).filter((note): note is NonNullable<typeof note> => Boolean(note));
  if (internalNotes.length) detail.internalNotes = internalNotes;

  if (entry.activeOffer) {
    detail.activeOffer = {
      publicReference: entry.activeOffer.publicReference,
      status: entry.activeOffer.status,
      statusLabel: WAITING_LIST_OFFER_STATUS_LABELS[entry.activeOffer.status],
      whenLabel: entry.activeOffer.whenLabel,
      expiresAt: entry.activeOffer.expiresAt,
      href: adminWaitingListOfferHref(entry.activeOffer.publicReference),
    };
    const priceLabel = asSafeText(root.activeOfferPriceLabel ?? root.priceLabel);
    if (priceLabel) detail.activeOffer.priceLabel = priceLabel;
    const depositLabel = asSafeText(root.activeOfferDepositLabel ?? root.depositLabel);
    if (depositLabel) detail.activeOffer.depositLabel = depositLabel;
    const serverNow = readString(root.serverNow) ?? readString(root.offerServerNow);
    if (serverNow) detail.activeOffer.serverNow = serverNow;
  }

  const notification = adaptNotification(root.notification ?? root.notificationStatus);
  if (notification) detail.notification = notification;

  const appointmentReference =
    publicId(root.appointmentReference) ?? publicId(root.bookingReference);
  if (appointmentReference) {
    detail.appointmentReference = appointmentReference;
    detail.appointmentHref = routes.admin.appointmentDetail(appointmentReference);
  }

  const createdAtLabel =
    entry.createdLabel ??
    formatRelativeTime(entry.createdAt) ??
    formatAppointmentParts(entry.createdAt)?.label;
  if (createdAtLabel) detail.createdAtLabel = createdAtLabel;
  const updatedAtLabel = asSafeText(root.updatedAtLabel);
  if (updatedAtLabel) detail.updatedAtLabel = updatedAtLabel;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;

  return detail;
}

export function validateAdminWaitingListManualEntry(
  input: AdminWaitingListManualEntryInput,
): AdminWaitingListManualEntryErrors {
  const errors: AdminWaitingListManualEntryErrors = {};
  if (!input.customerReference.trim()) errors.customerReference = "مشتری را انتخاب کنید.";
  if (!input.serviceId.trim()) errors.serviceId = "خدمت را انتخاب کنید.";
  if (input.timePreference === "exact" && (!input.timeFrom || !input.timeTo)) {
    errors.time = "بازه ساعت را کامل وارد کنید.";
  }
  return errors;
}

function preferenceBody(preference: ProviderPreference) {
  if (preference.type === "specific") {
    return { type: "specific", providerId: preference.providerId };
  }
  return { type: preference.type };
}

export function sanitizeAdminWaitingListManualEntryBody(
  input: AdminWaitingListManualEntryInput,
  version?: string,
) {
  const body: Record<string, unknown> = {
    customerReference: input.customerReference.trim(),
    serviceId: input.serviceId.trim(),
    providerPreference: preferenceBody(input.providerPreference),
    datePreference: input.datePreference,
    timePreference: input.timePreference,
  };
  if (input.branchId?.trim()) body.branchId = input.branchId.trim();
  if (input.timeFrom?.trim()) body.timeFrom = input.timeFrom.trim();
  if (input.timeTo?.trim()) body.timeTo = input.timeTo.trim();
  if (input.customerNote?.trim()) body.customerNote = input.customerNote.trim();
  if (input.internalNote?.trim()) body.internalNote = input.internalNote.trim();
  if (version) body.version = version;
  return body;
}

export function adaptAdminWaitingListDuplicateCheck(
  payload: unknown,
): AdminWaitingListDuplicateCheck {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const duplicate = readBoolean(source.duplicate) === true || readBoolean(source.exists) === true;
  const result: AdminWaitingListDuplicateCheck = { duplicate };
  const message = asSafeText(source.message) ?? asSafeText(source.reason);
  if (message) result.message = message;
  const existingReference =
    publicId(source.existingReference) ?? publicId(source.entryReference);
  if (existingReference) {
    result.existingReference = existingReference;
    result.existingHref = adminWaitingListDetailHref(existingReference);
  }
  return result;
}

export function adaptAdminWaitingListImpactPreview(
  payload: unknown,
): AdminWaitingListImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش اثر";
  const preview: AdminWaitingListImpactPreview = {
    title,
    effects: asList(root, ["effects", "items"]).map((item) => asSafeText(item)).filter(Boolean) as string[],
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
  };
  const summary = asSafeText(root.summary) ?? asSafeText(root.description);
  if (summary) preview.summary = summary;
  if (readBoolean(root.activeOfferAffected) === true) preview.activeOfferAffected = true;
  if (readBoolean(root.notificationAffected) === true) preview.notificationAffected = true;
  if (readBoolean(root.requiresReason) === true) preview.requiresReason = true;
  const reasonOptions = asList(root, ["reasonOptions", "reasons"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? readString(item.value);
    const label = asSafeText(item.label);
    return id && label ? { id, label } : null;
  }).filter((item): item is { id: string; label: string } => Boolean(item));
  if (reasonOptions.length) preview.reasonOptions = reasonOptions;
  const confirmLabel = asSafeText(root.confirmLabel);
  if (confirmLabel) preview.confirmLabel = confirmLabel;
  const previewVersion = readString(root.previewVersion) ?? readString(root.version);
  if (previewVersion) preview.previewVersion = previewVersion;
  if (readBoolean(root.blocked) === true) preview.blocked = true;
  const blockedReason = asSafeText(root.blockedReason);
  if (blockedReason) preview.blockedReason = blockedReason;
  return preview;
}

export function adaptAdminWaitingListOfferEligibility(
  payload: unknown,
): AdminWaitingListOfferEligibility {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const eligible = readBoolean(source.eligible) === true || readBoolean(source.canOffer) === true;
  const view: AdminWaitingListOfferEligibility = { eligible };
  const reason = asSafeText(source.reason) ?? asSafeText(source.message);
  if (reason) view.reason = reason;
  if (readBoolean(source.hasActiveOffer) === true) view.hasActiveOffer = true;
  const entryStatus = parseWaitingListEntryStatus(source.entryStatus ?? source.status);
  if (entryStatus !== "unknown") view.entryStatus = entryStatus;
  return view;
}

export function adaptAdminWaitingListAvailabilityDays(
  payload: unknown,
): AdminWaitingListAvailabilityDay[] {
  const root = unwrapPayload(payload);
  return asList(root, ["days", "dates", "items"]).map((item) => {
    if (typeof item === "string") {
      return { date: item, label: item };
    }
    if (!isRecord(item)) return null;
    const date = readString(item.date);
    if (!date) return null;
    const day: AdminWaitingListAvailabilityDay = { date };
    const label = asSafeText(item.label) ?? date;
    day.label = label;
    if (readBoolean(item.hasSlots) !== undefined) day.hasSlots = readBoolean(item.hasSlots);
    return day;
  }).filter((item): item is AdminWaitingListAvailabilityDay => Boolean(item));
}

export function adaptAdminWaitingListAvailabilitySlots(
  payload: unknown,
): AdminWaitingListAvailabilitySlot[] {
  const root = unwrapPayload(payload);
  return asList(root, ["slots", "items", "times"]).map((item) => {
    if (!isRecord(item) || isInternalResource(item)) return null;
    const id = publicId(item.id) ?? publicId(item.slotId) ?? publicId(item.reference);
    const startsAt = readString(item.startsAt) ?? readString(item.start);
    if (!id || !startsAt) return null;
    const label =
      asSafeText(item.label) ??
      formatAppointmentParts(startsAt)?.label ??
      startsAt;
    const slot: AdminWaitingListAvailabilitySlot = { id, startsAt, label };
    const providerName = asSafeText(item.providerName);
    if (providerName) slot.providerName = providerName;
    const branchName = asSafeText(item.branchName);
    if (branchName) slot.branchName = branchName;
    if (readBoolean(item.available) !== undefined) slot.available = readBoolean(item.available);
    return slot;
  }).filter((item): item is AdminWaitingListAvailabilitySlot => Boolean(item));
}

export function adaptAdminWaitingListOfferPreview(
  payload: unknown,
): AdminWaitingListOfferPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const serviceName = asSafeText(root.serviceName) ?? asSafeText(isRecord(root.service) ? root.service.name : undefined);
  const slotLabel =
    asSafeText(root.slotLabel) ??
    asSafeText(root.whenLabel) ??
    (readString(root.startsAt) ? formatAppointmentParts(readString(root.startsAt)!)?.label : undefined);
  if (!serviceName || !slotLabel) return null;

  const expirationOptions = asList(root, ["expirationOptions", "expiryOptions"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? readString(item.value);
    const label = asSafeText(item.label);
    if (!id || !label) return null;
    const option: AdminWaitingListOfferExpirationOption = { id, label };
    const minutes = readNumber(item.minutes);
    if (typeof minutes === "number") option.minutes = minutes;
    return option;
  }).filter((item): item is AdminWaitingListOfferExpirationOption => Boolean(item));

  const preview: AdminWaitingListOfferPreview = {
    serviceName,
    slotLabel,
    expirationOptions,
  };
  const title = asSafeText(root.title);
  if (title) preview.title = title;
  const summary = asSafeText(root.summary);
  if (summary) preview.summary = summary;
  const branchName = asSafeText(root.branchName);
  if (branchName) preview.branchName = branchName;
  const providerName = asSafeText(root.providerName);
  if (providerName) preview.providerName = providerName;
  const priceLabel = asSafeText(root.priceLabel);
  if (priceLabel) preview.priceLabel = priceLabel;
  const depositLabel = asSafeText(root.depositLabel);
  if (depositLabel) preview.depositLabel = depositLabel;
  const policySummary = asSafeText(root.policySummary ?? root.policyWarning);
  if (policySummary) preview.policySummary = policySummary;
  const nextStepLabel = asSafeText(root.nextStepLabel);
  if (nextStepLabel) preview.nextStepLabel = nextStepLabel;
  const defaultExpirationId = readString(root.defaultExpirationId);
  if (defaultExpirationId) preview.defaultExpirationId = defaultExpirationId;
  const previewVersion = readString(root.previewVersion) ?? readString(root.version);
  if (previewVersion) preview.previewVersion = previewVersion;
  if (readBoolean(root.blocked) === true) preview.blocked = true;
  const blockedReason = asSafeText(root.blockedReason);
  if (blockedReason) preview.blockedReason = blockedReason;
  return preview;
}

export function adaptAdminWaitingListOfferSendResult(
  payload: unknown,
): AdminWaitingListOfferSendResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const entryReference =
    publicId(root.entryReference) ?? publicId(root.waitingListEntryReference);
  const offerReference =
    publicId(root.offerReference) ?? publicId(root.publicReference) ?? publicId(root.reference);
  if (!entryReference || !offerReference) return null;
  const offerStatus = parseWaitingListOfferStatus(root.offerStatus ?? root.status);
  const result: AdminWaitingListOfferSendResult = {
    entryReference,
    offerReference,
    offerStatus,
    offerStatusLabel: WAITING_LIST_OFFER_STATUS_LABELS[offerStatus],
  };
  const expiresAt = readString(root.expiresAt);
  if (expiresAt) result.expiresAt = expiresAt;
  const serverNow = readString(root.serverNow);
  if (serverNow) result.serverNow = serverNow;
  const notification = adaptNotification(root.notification);
  if (notification) result.notification = notification;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) result.version = version;
  const message = asSafeText(root.message);
  if (message) result.message = message;
  return result;
}

export function isAdminWaitingListConflict(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 409 ||
    error.code?.includes("CONFLICT") === true ||
    error.code?.includes("VERSION") === true
  );
}

export function isDuplicateWaitingListEntryError(error: {
  status?: number;
  code?: string;
}): boolean {
  return (
    error.status === 409 ||
    error.code?.includes("DUPLICATE") === true ||
    error.code?.includes("EXISTS") === true
  );
}

export function isSlotTakenWaitingListError(error: { status?: number; code?: string }): boolean {
  return error.status === 409 || error.code?.includes("SLOT_TAKEN") === true;
}

export function adminWaitingListConflictMessage(): string {
  return "درخواست توسط کاربر دیگری تغییر کرده است. لطفاً صفحه را به‌روز کنید.";
}

export function adminWaitingListDuplicateMessage(): string {
  return "این مشتری قبلاً برای این خدمت در لیست انتظار ثبت شده است.";
}

export { parseJoinDatePreference } from "@/lib/customer/waiting-list-adapter";
