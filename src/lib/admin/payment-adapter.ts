import {
  adaptPaymentHistoryDetail,
  adaptPaymentHistoryItem,
  adaptPaymentHistoryList,
  adaptPaymentReceiptUrl,
} from "@/lib/customer/payment-history-adapter";
import { adminPaymentDetailHref } from "@/lib/admin/payment-filters";
import { adminPaymentFiltersApplied } from "@/lib/admin/payment-filters";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { routes } from "@/constants/routes";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { parseStatusKey } from "@/lib/status/status-map";
import type { PaymentHistoryFilters } from "@/types/payment-history";
import type {
  AdminManualPaymentOptionView,
  AdminManualPaymentOptionsView,
  AdminManualPaymentResult,
  AdminPaymentAllowedActions,
  AdminPaymentAppointmentSummary,
  AdminPaymentBranchSummary,
  AdminPaymentCapabilities,
  AdminPaymentCustomerSummary,
  AdminPaymentDetailView,
  AdminPaymentFilterOptions,
  AdminPaymentInternalNoteView,
  AdminPaymentListFilters,
  AdminPaymentListItemView,
  AdminPaymentListView,
  AdminPaymentRefundPreview,
  AdminPaymentRefundResult,
  AdminPaymentRevenueSummaryView,
  AdminPaymentTimelineEntry,
} from "@/types/admin-payment";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) ? raw : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function adaptAllowedActions(value: unknown): AdminPaymentAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    viewDetail: readBoolean(source.viewDetail) !== false,
    viewPrivateFinancialData: readBoolean(source.viewPrivateFinancialData) === true,
    recordManualPayment: readBoolean(source.recordManualPayment) === true,
    issueRefund: readBoolean(source.issueRefund) === true,
    downloadReceipt: readBoolean(source.downloadReceipt) === true,
    copyReferences: readBoolean(source.copyReferences) !== false,
  };
}

function adaptCapabilities(value: unknown): AdminPaymentCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsManualPayment: readBoolean(source.supportsManualPayment) === true,
    supportsRefundPreview: readBoolean(source.supportsRefundPreview) !== false,
    supportsPartialRefund: readBoolean(source.supportsPartialRefund) === true,
    supportsReceipt: readBoolean(source.supportsReceipt) === true,
    supportsRevenueSummary: readBoolean(source.supportsRevenueSummary) === true,
    supportsInternalNotes: readBoolean(source.supportsInternalNotes) === true,
  };
}

function adaptCustomerSummary(value: unknown): AdminPaymentCustomerSummary | undefined {
  if (!isRecord(value)) return undefined;
  const reference =
    publicId(value.reference) ??
    publicId(value.customerReference) ??
    publicId(value.id);
  if (!reference) return undefined;
  const displayName =
    asSafeText(value.displayName) ??
    asSafeText(value.name) ??
    asSafeText(value.fullName);
  if (!displayName) return undefined;
  const summary: AdminPaymentCustomerSummary = {
    reference,
    displayName,
    href: routes.admin.customerDetail(reference),
  };
  const phoneMasked = asSafeText(value.phoneMasked) ?? asSafeText(value.phoneLabel);
  if (phoneMasked) summary.phoneMasked = phoneMasked;
  const emailMasked = asSafeText(value.emailMasked) ?? asSafeText(value.emailLabel);
  if (emailMasked) summary.emailMasked = emailMasked;
  return summary;
}

function adaptAppointmentSummary(value: unknown): AdminPaymentAppointmentSummary | undefined {
  if (!isRecord(value)) return undefined;
  const reference =
    publicId(value.reference) ??
    publicId(value.appointmentReference) ??
    publicId(value.id);
  if (!reference) return undefined;
  const summary: AdminPaymentAppointmentSummary = {
    reference,
    href: routes.admin.appointmentDetail(reference),
  };
  const serviceName =
    asSafeText(value.serviceName) ??
    (isRecord(value.service) ? asSafeText(value.service.name) : undefined);
  if (serviceName) summary.serviceName = serviceName;
  const startsAt = readString(value.startsAt) ?? readString(value.startsAtLabel);
  const timeZone = readString(value.timezone) ?? readString(value.timeZone);
  const whenLabel =
    asSafeText(value.whenLabel) ??
    (startsAt ? formatAppointmentParts(startsAt, timeZone)?.label : undefined);
  if (whenLabel) summary.whenLabel = whenLabel;
  const status = parseStatusKey(value.status);
  if (status && status !== "unknown") summary.status = status;
  return summary;
}

function adaptBranchSummary(value: unknown): AdminPaymentBranchSummary | undefined {
  if (!isRecord(value)) return undefined;
  const reference = publicId(value.reference) ?? publicId(value.id) ?? publicId(value.branchId);
  const name = asSafeText(value.name) ?? asSafeText(value.label);
  if (!reference || !name) return undefined;
  return { reference, name };
}

function adaptFilterOptions(value: unknown): AdminPaymentFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminPaymentFilterOptions = {};
  const branches = asList(value, ["branches"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = publicId(item.id) ?? publicId(item.reference);
    const name = asSafeText(item.name);
    return id && name ? { id, name } : null;
  }).filter((item): item is { id: string; name: string } => Boolean(item));
  if (branches.length > 0) options.branches = branches;
  const methods = asList(value, ["methods", "paymentMethods"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? readString(item.value);
    const label = asSafeText(item.label) ?? asSafeText(item.name);
    return id && label ? { id, label } : null;
  }).filter((item): item is { id: string; label: string } => Boolean(item));
  if (methods.length > 0) options.methods = methods;
  return Object.keys(options).length > 0 ? options : undefined;
}

export function adaptAdminPaymentListItem(
  value: unknown,
  allowedActions?: AdminPaymentAllowedActions,
): AdminPaymentListItemView | null {
  const base = adaptPaymentHistoryItem(value);
  if (!base) return null;
  const source = isRecord(value) ? value : {};
  const actions = allowedActions ?? adaptAllowedActions(source.allowedActions);
  const reference = base.publicReference;
  const item: AdminPaymentListItemView = {
    ...base,
    detailHref: adminPaymentDetailHref(reference),
    canViewDetail: actions.viewDetail !== false,
    canIssueRefund: actions.issueRefund === true,
    canDownloadReceipt: actions.downloadReceipt === true,
  };
  const customer =
    adaptCustomerSummary(source.customer) ??
    adaptCustomerSummary(isRecord(source.customerSummary) ? source.customerSummary : undefined);
  if (customer) item.customer = customer;
  const appointment =
    adaptAppointmentSummary(source.appointment) ??
    (base.appointmentId
      ? {
          reference: base.appointmentId,
          href: routes.admin.appointmentDetail(base.appointmentId),
          serviceName: base.serviceName,
          whenLabel: base.appointmentWhenLabel,
        }
      : undefined);
  if (appointment) item.appointment = appointment;
  const branch =
    adaptBranchSummary(source.branch) ??
    adaptBranchSummary(isRecord(source.branchSummary) ? source.branchSummary : undefined);
  if (branch) item.branch = branch;
  return item;
}

export function adaptAdminPaymentList(
  payload: unknown,
  filters: AdminPaymentListFilters,
): AdminPaymentListView {
  const historyFilters: PaymentHistoryFilters = {
    status: filters.status,
    page: filters.page,
  };
  if (filters.q) historyFilters.q = filters.q;
  if (filters.appointmentId) historyFilters.appointmentId = filters.appointmentId;
  if (filters.from) historyFilters.from = filters.from;
  if (filters.to) historyFilters.to = filters.to;

  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const list = asList(root, ["items", "payments", "results"]);
  const items = list
    .map((item) => adaptAdminPaymentListItem(item))
    .filter((item): item is AdminPaymentListItemView => Boolean(item));

  const base = adaptPaymentHistoryList(payload, historyFilters);
  const filtersOn = adminPaymentFiltersApplied(filters) || base.filtersApplied;
  const filterOptions = adaptFilterOptions(source.filterOptions ?? source.filters);
  const revenueSummaryAvailable =
    readBoolean(source.revenueSummaryAvailable) === true ||
    readBoolean(isRecord(source.capabilities) ? source.capabilities.supportsRevenueSummary : undefined) === true;

  return {
    items: items.length > 0 ? items : base.items.map((item) => ({
      ...item,
      detailHref: adminPaymentDetailHref(item.publicReference),
      canViewDetail: true,
      canIssueRefund: false,
      canDownloadReceipt: item.receiptAvailable,
    })),
    page: base.page,
    hasMore: base.hasMore,
    emptyHistory: base.emptyHistory,
    filtersApplied: filtersOn,
    revenueSummaryAvailable,
    ...(base.pageCount !== undefined ? { pageCount: base.pageCount } : {}),
    ...(base.totalCount !== undefined ? { totalCount: base.totalCount } : {}),
    ...(filterOptions ? { filterOptions } : {}),
  };
}

function adaptTimeline(value: unknown): AdminPaymentTimelineEntry[] {
  return asList(value, ["timeline", "events", "history"]).map((entry, index) => {
    if (!isRecord(entry)) return null;
    const id = readString(entry.id) ?? `event-${index}`;
    const label = asSafeText(entry.label) ?? asSafeText(entry.title) ?? "رویداد";
    const item: AdminPaymentTimelineEntry = { id, label };
    const timestamp = readString(entry.timestamp) ?? readString(entry.at) ?? readString(entry.createdAt);
    if (timestamp) item.timestamp = timestamp;
    const timestampLabel =
      asSafeText(entry.timestampLabel) ??
      (timestamp ? formatAppointmentParts(timestamp)?.label : undefined);
    if (timestampLabel) item.timestampLabel = timestampLabel;
    const status = parseStatusKey(entry.status);
    if (status && status !== "unknown") item.status = status;
    const description = asSafeText(entry.description) ?? asSafeText(entry.message);
    if (description) item.description = description;
    return item;
  }).filter((item): item is AdminPaymentTimelineEntry => Boolean(item));
}

function adaptInternalNotes(value: unknown): AdminPaymentInternalNoteView[] {
  return asList(value, ["internalNotes", "notes"]).map((entry, index) => {
    if (!isRecord(entry)) return null;
    const body = asSafeText(entry.body) ?? asSafeText(entry.text);
    if (!body) return null;
    const note: AdminPaymentInternalNoteView = {
      id: readString(entry.id) ?? `note-${index}`,
      body,
    };
    const authorLabel = asSafeText(entry.authorLabel) ?? asSafeText(entry.author);
    if (authorLabel) note.authorLabel = authorLabel;
    const createdAtLabel = asSafeText(entry.createdAtLabel) ?? asSafeText(entry.createdAt);
    if (createdAtLabel) note.createdAtLabel = createdAtLabel;
    return note;
  }).filter((item): item is AdminPaymentInternalNoteView => Boolean(item));
}

export function adaptAdminPaymentDetail(payload: unknown): AdminPaymentDetailView | null {
  const root = unwrapPayload(payload);
  const baseDetail = adaptPaymentHistoryDetail(root);
  const listItem = adaptAdminPaymentListItem(root);
  if (!baseDetail || !listItem) return null;

  const source = isRecord(root) ? root : {};
  const allowedActions = adaptAllowedActions(source.allowedActions);
  const capabilities = adaptCapabilities(source.capabilities);

  const detail: AdminPaymentDetailView = {
    ...listItem,
    ...baseDetail,
    timeline: adaptTimeline(source),
    internalNotes: adaptInternalNotes(source),
    allowedActions,
    capabilities,
  };

  const updatedAt = readString(source.updatedAt);
  if (updatedAt) detail.updatedAt = updatedAt;
  const failedAt = readString(source.failedAt);
  if (failedAt) detail.failedAt = failedAt;
  const expiredAt = readString(source.expiredAt);
  if (expiredAt) detail.expiredAt = expiredAt;
  const remainingBalanceLabel =
    asSafeText(source.remainingBalanceLabel) ??
    asSafeText(isRecord(source.appointmentBalance) ? source.appointmentBalance.label : undefined);
  if (remainingBalanceLabel) detail.remainingBalanceLabel = remainingBalanceLabel;
  const failureMessage = asSafeText(source.failureMessage) ?? asSafeText(source.safeFailureMessage);
  if (failureMessage) detail.failureMessage = failureMessage;
  const instrumentMasked =
    asSafeText(source.instrumentMasked) ??
    asSafeText(isRecord(source.instrument) ? source.instrument.masked : undefined);
  if (instrumentMasked) detail.instrumentMasked = instrumentMasked;
  const version = readString(source.version) ?? readString(source.etag);
  if (version) detail.version = version;

  detail.canViewDetail = allowedActions.viewDetail !== false;
  detail.canIssueRefund = allowedActions.issueRefund === true;
  detail.canDownloadReceipt = allowedActions.downloadReceipt === true;

  return detail;
}

export function adaptAdminPaymentRevenueSummary(payload: unknown): AdminPaymentRevenueSummaryView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { state: "unavailable" };
  }
  if (readBoolean(root.error) === true || readString(root.state) === "error") {
    return { state: "error" };
  }
  if (readBoolean(root.available) === false || readString(root.state) === "unavailable") {
    return { state: "unavailable" };
  }

  const summary: AdminPaymentRevenueSummaryView = { state: "available" };
  const collectedLabel =
    asSafeText(root.collectedLabel) ??
    asSafeText(isRecord(root.collected) ? root.collected.label : undefined);
  if (collectedLabel) summary.collectedLabel = collectedLabel;
  const pendingLabel =
    asSafeText(root.pendingLabel) ??
    asSafeText(isRecord(root.pending) ? root.pending.label : undefined);
  if (pendingLabel) summary.pendingLabel = pendingLabel;
  const refundedLabel =
    asSafeText(root.refundedLabel) ??
    asSafeText(isRecord(root.refunded) ? root.refunded.label : undefined);
  if (refundedLabel) summary.refundedLabel = refundedLabel;
  const netRevenueLabel =
    asSafeText(root.netRevenueLabel) ??
    asSafeText(isRecord(root.netRevenue) ? root.netRevenue.label : undefined);
  if (netRevenueLabel) summary.netRevenueLabel = netRevenueLabel;
  const successfulCount = readNumber(root.successfulCount) ?? readNumber(root.successCount);
  if (typeof successfulCount === "number") summary.successfulCount = successfulCount;
  const periodLabel = asSafeText(root.periodLabel);
  if (periodLabel) summary.periodLabel = periodLabel;
  const branchLabel = asSafeText(root.branchLabel);
  if (branchLabel) summary.branchLabel = branchLabel;

  const breakdown = asList(root, ["methodBreakdown", "methods"]).map((item) => {
    if (!isRecord(item)) return null;
    const methodLabel = asSafeText(item.methodLabel) ?? asSafeText(item.label);
    const amountLabel = asSafeText(item.amountLabel) ?? asSafeText(item.totalLabel);
    return methodLabel && amountLabel ? { methodLabel, amountLabel } : null;
  }).filter((item): item is { methodLabel: string; amountLabel: string } => Boolean(item));
  if (breakdown.length > 0) summary.methodBreakdown = breakdown;

  if (
    !summary.collectedLabel &&
    !summary.pendingLabel &&
    !summary.refundedLabel &&
    !summary.netRevenueLabel
  ) {
    return { state: "unavailable" };
  }

  return summary;
}

export function adaptAdminPaymentRefundPreview(payload: unknown): AdminPaymentRefundPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const maxRefundableLabel =
    asSafeText(root.maxRefundableLabel) ??
    asSafeText(isRecord(root.maxRefundable) ? root.maxRefundable.label : undefined);
  if (!maxRefundableLabel) return null;
  const preview: AdminPaymentRefundPreview = {
    title: asSafeText(root.title) ?? "پیش‌نمایش بازپرداخت",
    maxRefundableLabel,
    allowsPartial: readBoolean(root.allowsPartial) === true || readBoolean(root.supportsPartial) === true,
    requiresReason: readBoolean(root.requiresReason) === true,
  };
  const summary = asSafeText(root.summary) ?? asSafeText(root.description);
  if (summary) preview.summary = summary;
  const currency = readString(root.currency);
  if (currency) preview.currency = currency;
  const policyLabel = asSafeText(root.policyLabel);
  if (policyLabel) preview.policyLabel = policyLabel;
  const paymentVersion = readString(root.paymentVersion) ?? readString(root.version);
  if (paymentVersion) preview.paymentVersion = paymentVersion;
  const reasonOptions = asList(root, ["reasonOptions", "reasons"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? readString(item.code);
    const label = asSafeText(item.label);
    return id && label ? { id, label } : null;
  }).filter((item): item is { id: string; label: string } => Boolean(item));
  if (reasonOptions.length > 0) preview.reasonOptions = reasonOptions;
  return preview;
}

export function adaptAdminPaymentRefundResult(payload: unknown): AdminPaymentRefundResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    publicId(root.reference) ??
    publicId(root.paymentReference) ??
    publicId(root.refundReference);
  if (!reference) return null;
  const refundStatus = parseStatusKey(root.refundStatus ?? root.status) ?? "unknown";
  const result: AdminPaymentRefundResult = {
    reference,
    refundStatus,
    pending:
      readBoolean(root.pending) === true ||
      refundStatus === "pendingPayment" ||
      refundStatus === "processing",
  };
  const refundAmountLabel = asSafeText(root.refundAmountLabel);
  if (refundAmountLabel) result.refundAmountLabel = refundAmountLabel;
  const refundReference = publicId(root.refundReference);
  if (refundReference) result.refundReference = refundReference;
  const message = asSafeText(root.message);
  if (message) result.message = message;
  return result;
}

export function adaptAdminManualPaymentOptions(payload: unknown): AdminManualPaymentOptionsView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { appointmentReference: "", options: [], state: "unavailable" };
  }
  if (readBoolean(root.error) === true) {
    return {
      appointmentReference: readString(root.appointmentReference) ?? "",
      options: [],
      state: "error",
    };
  }
  const appointmentReference =
    publicId(root.appointmentReference) ??
    publicId(root.appointmentId) ??
    publicId(isRecord(root.appointment) ? root.appointment.reference : undefined) ??
    "";
  const options = asList(root, ["options", "methods"]).map((item) => {
    if (!isRecord(item)) return null;
    const type = readString(item.type) ?? readString(item.method);
    const title = asSafeText(item.title) ?? asSafeText(item.label);
    if (!type || !title) return null;
    const option: AdminManualPaymentOptionView = {
      type,
      title,
      allowsCustomAmount: readBoolean(item.allowsCustomAmount) === true,
      requiresReceiptReference: readBoolean(item.requiresReceiptReference) === true,
      allowsInternalNote: readBoolean(item.allowsInternalNote) === true,
    };
    const description = asSafeText(item.description);
    if (description) option.description = description;
    const outstandingBalanceLabel = asSafeText(item.outstandingBalanceLabel);
    if (outstandingBalanceLabel) option.outstandingBalanceLabel = outstandingBalanceLabel;
    const minAmountLabel = asSafeText(item.minAmountLabel);
    if (minAmountLabel) option.minAmountLabel = minAmountLabel;
    const maxAmountLabel = asSafeText(item.maxAmountLabel);
    if (maxAmountLabel) option.maxAmountLabel = maxAmountLabel;
    return option;
  }).filter((item): item is AdminManualPaymentOptionView => Boolean(item));

  const outstandingBalanceLabel = asSafeText(root.outstandingBalanceLabel);
  const view: AdminManualPaymentOptionsView = {
    appointmentReference,
    options,
    state: options.length > 0 ? "available" : "unavailable",
  };
  if (outstandingBalanceLabel) view.outstandingBalanceLabel = outstandingBalanceLabel;
  return view;
}

export function adaptAdminManualPaymentResult(payload: unknown): AdminManualPaymentResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const paymentReference =
    publicId(root.paymentReference) ??
    publicId(root.reference) ??
    publicId(root.id);
  const amountLabel = asSafeText(root.amountLabel) ?? asSafeText(root.amount);
  if (!paymentReference || !amountLabel) return null;
  const status = parseStatusKey(root.status ?? root.paymentStatus) ?? "unknown";
  const result: AdminManualPaymentResult = {
    paymentReference,
    status,
    amountLabel,
  };
  const message = asSafeText(root.message);
  if (message) result.message = message;
  return result;
}

export function isAdminPaymentConflict(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 409 ||
    error.code?.includes("CONFLICT") === true ||
    error.code?.includes("VERSION") === true ||
    error.code?.includes("STALE") === true
  );
}

export function adminPaymentConflictMessage(): string {
  return "اطلاعات پرداخت توسط کاربر دیگری تغییر کرده است. لطفاً صفحه را به‌روز کنید و دوباره تلاش کنید.";
}

export { adaptPaymentReceiptUrl };
