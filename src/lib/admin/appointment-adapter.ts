import {
  adaptAppointmentListItem,
  appointmentProviderLabel,
} from "@/lib/customer/appointment-adapter";
import { adaptCustomerTimeline } from "@/lib/customer/appointment-detail-adapter";
import {
  adaptCancellationPreview,
  adaptCancellationResult,
} from "@/lib/customer/appointment-cancellation-adapter";
import { formatCurrencyAmount } from "@/lib/date-time/format";
import { routes } from "@/constants/routes";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { parseStatusKey, type StatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type { PaymentSummaryView } from "@/types/appointment-detail";
import type {
  AdminAppointmentAllowedActions,
  AdminAppointmentActionKey,
  AdminAppointmentDetailView,
  AdminAppointmentFilterOptions,
  AdminAppointmentListItem,
  AdminAppointmentListView,
  AdminAppointmentMutationResult,
  AdminCustomerSnapshot,
  AdminResourceSnapshot,
} from "@/types/admin-appointment";
import type { AppointmentListItemView } from "@/types/appointment-list";

export { appointmentProviderLabel, adaptCancellationPreview, adaptCancellationResult };

const ACTION_KEYS: AdminAppointmentActionKey[] = [
  "confirm",
  "checkIn",
  "start",
  "complete",
  "markNoShow",
  "cancel",
  "reschedule",
  "editInternalNote",
];

const ACTION_ALIASES: Record<string, AdminAppointmentActionKey> = {
  confirm: "confirm",
  check_in: "checkIn",
  checkin: "checkIn",
  start: "start",
  complete: "complete",
  mark_no_show: "markNoShow",
  noshow: "markNoShow",
  no_show: "markNoShow",
  cancel: "cancel",
  reschedule: "reschedule",
  edit_internal_note: "editInternalNote",
  internal_note: "editInternalNote",
};

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function readStatus(value: unknown): StatusKey | undefined {
  const parsed = parseStatusKey(value);
  if (parsed) return parsed;
  return readString(value) ? "unknown" : undefined;
}

export function adaptAdminAllowedActions(root: Record<string, unknown>): AdminAppointmentAllowedActions {
  const source = isRecord(root.allowedActions)
    ? root.allowedActions
    : isRecord(root.actions)
      ? root.actions
      : root;
  const actions: AdminAppointmentAllowedActions = {};
  for (const key of ACTION_KEYS) {
    const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (readBoolean(source[key]) === true || readBoolean(source[snake]) === true) {
      actions[key] = true;
    }
  }
  if (Array.isArray(source.allowed) || Array.isArray(source.list)) {
    const list = (source.allowed ?? source.list) as unknown[];
    for (const item of list) {
      const raw = readString(item)?.toLowerCase().replace(/[\s-]+/g, "_");
      if (raw && ACTION_ALIASES[raw]) {
        actions[ACTION_ALIASES[raw]] = true;
      }
    }
  }
  if (readBoolean(source.processing) === true) {
    actions.processing = true;
  }
  const blocked = asSafeText(source.blockedReason) ?? asSafeText(source.reason);
  if (blocked) actions.blockedReason = blocked;
  return actions;
}

function adaptCustomer(root: Record<string, unknown>): AdminCustomerSnapshot | undefined {
  const source = isRecord(root.customer) ? root.customer : root;
  const name =
    asSafeText(source.customerName) ??
    asSafeText(source.displayName) ??
    asSafeText(source.name) ??
    asSafeText(source.maskedName);
  if (!name) return undefined;
  const snapshot: AdminCustomerSnapshot = { name };
  const id = publicId(source.customerId) ?? publicId(source.id);
  if (id) snapshot.id = id;
  if (readBoolean(source.contactMasked) === true) {
    snapshot.contactMasked = true;
  }
  const phone = readString(source.phone) ?? readString(source.maskedPhone);
  if (phone) snapshot.phone = phone;
  const email = readString(source.email) ?? readString(source.maskedEmail);
  if (email) snapshot.email = email;
  const profileHref = readString(source.profileHref) ?? readString(source.href);
  if (profileHref?.startsWith("/admin")) {
    snapshot.profileHref = profileHref;
  }
  return snapshot;
}

function adaptPayment(root: Record<string, unknown>): PaymentSummaryView {
  const source = isRecord(root.payment) ? root.payment : root;
  const currency = readString(source.currency);
  return {
    status: readStatus(source.status) ?? readStatus(source.paymentStatus),
    totalLabel:
      readString(source.totalLabel) ??
      readString(source.amountLabel) ??
      (typeof readNumber(source.total) === "number"
        ? formatCurrencyAmount(readNumber(source.total) as number, currency)
        : undefined),
    paidLabel: readString(source.paidLabel) ?? readString(source.paidAmountLabel),
    depositLabel: readString(source.depositLabel),
    remainingLabel: readString(source.remainingLabel),
    methodLabel: readString(source.methodLabel),
    transactionReference: readString(source.transactionReference) ?? readString(source.reference),
    refundStatus: readStatus(source.refundStatus),
    receiptUrl: readString(source.receiptUrl),
  };
}

function adaptResources(root: Record<string, unknown>): AdminResourceSnapshot[] {
  return asList(root.resources ?? root.allocations, ["items", "resources", "results"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.resourceId);
      const name = asSafeText(item.name) ?? asSafeText(item.resourceName);
      if (!id || !name) return null;
      const resource: AdminResourceSnapshot = { id, name };
      const type = readString(item.type) ?? readString(item.resourceType);
      if (type) resource.type = type;
      return resource;
    })
    .filter((item): item is AdminResourceSnapshot => Boolean(item));
}

function baseListItemFromCustomer(item: AppointmentListItemView): AdminAppointmentListItem {
  return {
    id: item.id,
    reference: item.publicReference,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    timezone: item.timezone,
    durationMinutes: item.durationMinutes,
    customerName: "—",
    service: item.service,
    provider: item.provider,
    branch: item.branch,
    status: item.status,
    paymentStatus: item.paymentStatus,
    allowedActions: {},
  };
}

export function adaptAdminAppointmentListItem(
  value: unknown,
  now = new Date(),
): AdminAppointmentListItem | null {
  if (!isRecord(value)) return null;
  const source: Record<string, unknown> = { ...value };
  if (!parseStatusKey(source.status) && readString(source.status)) {
    source.status = "unknown";
  }
  const customerItem = adaptAppointmentListItem(source, now);
  if (!customerItem) return null;

  const item = baseListItemFromCustomer(customerItem);
  item.reference =
    readString(value.reference) ??
    readString(value.bookingReference) ??
    customerItem.publicReference;
  item.customerName =
    asSafeText(value.customerName) ??
    (isRecord(value.customer)
      ? asSafeText(value.customer.displayName) ??
        asSafeText(value.customer.name) ??
        asSafeText(value.customer.maskedName)
      : undefined) ??
    "—";
  item.resourceName =
    readString(value.resourceName) ??
    (isRecord(value.resource) ? readString(value.resource.name) : undefined);
  item.bookingSource =
    readString(value.bookingSource) ??
    readString(value.source) ??
    readString(value.channel);
  item.allowedActions = adaptAdminAllowedActions(value);
  return item;
}

export function adaptAdminAppointmentList(payload: unknown, page: number): AdminAppointmentListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(source, ["items", "appointments", "results"])
    .map((item) => adaptAdminAppointmentListItem(item))
    .filter((item): item is AdminAppointmentListItem => Boolean(item));

  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const nextCursor = readString(source.nextCursor) ?? readString(source.cursor);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    Boolean(nextCursor) ||
    (typeof pageCount === "number" && page < pageCount);

  return {
    items,
    page,
    pageCount: pageCount ?? undefined,
    totalCount: totalCount ?? undefined,
    hasMore,
    nextCursor,
    filtersApplied: readBoolean(source.filtersApplied) === true,
    emptyHistory: readBoolean(source.emptyHistory) === true,
    filterOptions: adaptFilterOptions(source.filterOptions ?? source.filters),
  };
}

function adaptFilterOptions(value: unknown): AdminAppointmentFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const readOptions = (key: string, alt?: string) =>
    asList(value[key] ?? (alt ? value[alt] : undefined), ["items", "options", "results"])
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = publicId(item.id) ?? publicId(item.value);
        const name = asSafeText(item.name) ?? asSafeText(item.label);
        if (!id || !name) return null;
        return { id, name };
      })
      .filter((item): item is { id: string; name: string } => Boolean(item));

  const options: AdminAppointmentFilterOptions = {};
  const services = readOptions("services");
  if (services.length) options.services = services;
  const staff = readOptions("staff", "providers");
  if (staff.length) options.staff = staff;
  const resources = readOptions("resources");
  if (resources.length) options.resources = resources;
  const branches = readOptions("branches");
  if (branches.length) options.branches = branches;
  const bookingSources = asList(value.bookingSources ?? value.sources, ["items", "options"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const val = readString(item.value) ?? readString(item.id);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      if (!val || !label) return null;
      return { value: val, label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  if (bookingSources.length) options.bookingSources = bookingSources;
  return Object.keys(options).length > 0 ? options : undefined;
}

export function adaptAdminAppointmentDetail(payload: unknown): AdminAppointmentDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) return null;

  const listItem = adaptAdminAppointmentListItem(root);
  if (!listItem) return null;

  const customer = adaptCustomer(root);
  if (!customer) return null;

  const payment = adaptPayment(root);
  const paymentRecord = isRecord(root.payment) ? root.payment : undefined;
  const paymentReference =
    readString(paymentRecord?.reference) ??
    readString(paymentRecord?.paymentReference) ??
    readString(paymentRecord?.publicReference) ??
    payment.transactionReference;
  const paymentHref =
    (paymentRecord ? readString(paymentRecord.href) : undefined) ??
    (paymentReference && isSafePublicId(paymentReference)
      ? routes.admin.paymentDetail(paymentReference)
      : undefined);
  const resources = adaptResources(root);
  const timelineRaw = root.timeline ?? root.events;
  const timeline = timelineRaw ? adaptCustomerTimeline(timelineRaw) : undefined;

  const service = {
    ...listItem.service,
    durationMinutes:
      readNumber(isRecord(root.service) ? root.service.durationMinutes : undefined) ??
      listItem.durationMinutes,
    description: isRecord(root.service)
      ? asSafeText(root.service.description)
      : undefined,
  };

  return {
    id: listItem.id,
    reference: listItem.reference,
    status: listItem.status,
    service,
    provider: listItem.provider,
    branch: listItem.branch,
    startsAt: listItem.startsAt,
    endsAt: listItem.endsAt,
    durationMinutes: listItem.durationMinutes,
    timezone: listItem.timezone,
    bookingSource: listItem.bookingSource,
    customer,
    payment: paymentHref ? { ...payment, paymentHref } : payment,
    resources: resources.length > 0 ? resources : undefined,
    customerNote: asSafeText(root.customerNote) ?? asSafeText(root.note),
    internalNote: asSafeText(root.internalNote) ?? asSafeText(root.staffNote),
    timeline,
    allowedActions: adaptAdminAllowedActions(root),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
  };
}

export function adaptAdminMutationResult(payload: unknown): AdminAppointmentMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    readString(root.reference) ??
    readString(root.appointmentReference) ??
    publicId(root.id);
  const status = readStatus(root.status) ?? readStatus(root.appointmentStatus);
  if (!reference || !status) return null;
  return {
    reference,
    status,
    message: asSafeText(root.message),
    version: readString(root.version),
    updatedAt: readString(root.updatedAt),
  };
}

export function isAdminAppointmentConflict(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return (
    code.includes("CONFLICT") ||
    code.includes("STALE") ||
    code.includes("VERSION") ||
    code.includes("UPDATED")
  );
}

export function adminConflictMessage(): string {
  return "این نوبت توسط فرد دیگری یا فرآیند دیگری به‌روزرسانی شده است. لطفاً آخرین وضعیت را بررسی کنید.";
}
