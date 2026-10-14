import { maskPhone, toE164IranMobile } from "@/lib/auth/phone";
import { adaptCustomerItem } from "@/lib/admin/manual-booking-adapter";
import { adaptPaymentHistoryList } from "@/lib/customer/payment-history-adapter";
import { adminCustomerDetailHref, adminCustomerEditHref } from "@/lib/admin/customer-filters";
import { routes } from "@/constants/routes";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import { parseStatusKey, type StatusKey } from "@/lib/status/status-map";
import {
  ADMIN_CUSTOMER_LIFECYCLE_LABELS,
  type AdminCustomerAllowedActions,
  type AdminCustomerCapabilities,
  type AdminCustomerContactView,
  type AdminCustomerDetailView,
  type AdminCustomerDuplicateMatch,
  type AdminCustomerFilterOptions,
  type AdminCustomerFormErrors,
  type AdminCustomerFormInput,
  type AdminCustomerImpactAction,
  type AdminCustomerImpactPreview,
  type AdminCustomerLifecycle,
  type AdminCustomerListItem,
  type AdminCustomerListView,
  type AdminCustomerMetricsView,
  type AdminCustomerMutationResult,
  type AdminCustomerNoteView,
  type AdminCustomerTagView,
  type AdminCustomerUpcomingAppointmentView,
} from "@/types/admin-customer";
import type { PaymentHistoryListView } from "@/types/payment-history";

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

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}•••@${domain}`;
}

export function adaptAdminCustomerLifecycle(value: unknown): AdminCustomerLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled") return "inactive";
  if (raw === "blocked" || raw === "block") return "blocked";
  if (readBoolean(value) === true) return "active";
  if (readBoolean(value) === false) return "inactive";
  return "unknown";
}

function adaptContact(value: unknown, allowedActions?: AdminCustomerAllowedActions): AdminCustomerContactView {
  const source = isRecord(value) ? value : {};
  const phone = readString(source.phone) ?? readString(source.mobile);
  const email = readString(source.email);
  const canViewFullPhone =
    allowedActions?.viewFullPhone === true || readBoolean(source.canViewFullPhone) === true;
  const canViewFullEmail =
    allowedActions?.viewFullEmail === true || readBoolean(source.canViewFullEmail) === true;
  const canCopyContact = allowedActions?.copyContact === true || readBoolean(source.canCopyContact) === true;

  const contact: AdminCustomerContactView = {
    canViewFullPhone,
    canViewFullEmail,
    canCopyContact,
    phoneVerified: readBoolean(source.phoneVerified) === true,
    emailVerified: readBoolean(source.emailVerified) === true,
  };

  if (canViewFullPhone && phone) {
    contact.phone = phone;
    contact.phoneMasked = asSafeText(source.phoneMasked) ?? maskPhone(phone);
  } else if (phone || source.phoneMasked) {
    contact.phoneMasked = asSafeText(source.phoneMasked) ?? (phone ? maskPhone(phone) : undefined);
  }

  if (canViewFullEmail && email) {
    contact.email = email;
    contact.emailMasked = asSafeText(source.emailMasked) ?? email;
  } else if (email || source.emailMasked) {
    contact.emailMasked = asSafeText(source.emailMasked) ?? (email ? maskEmail(email) : undefined);
  }

  return contact;
}

function adaptMetrics(value: unknown): AdminCustomerMetricsView {
  const source = isRecord(value) ? value : isRecord((value as { metrics?: unknown })?.metrics) ? (value as { metrics: Record<string, unknown> }).metrics : {};
  const unavailable = readBoolean(source.unavailable) === true || readBoolean(source.unknown) === true;
  const metrics: AdminCustomerMetricsView = { unavailable };
  const totalVisits = readNumber(source.totalVisits ?? source.visits);
  const cancellationCount = readNumber(source.cancellationCount ?? source.cancellations);
  const noShowCount = readNumber(source.noShowCount ?? source.noShows);
  if (totalVisits != null) metrics.totalVisits = totalVisits;
  else if (!unavailable) metrics.totalVisits = null;
  if (cancellationCount != null) metrics.cancellationCount = cancellationCount;
  else if (!unavailable) metrics.cancellationCount = null;
  if (noShowCount != null) metrics.noShowCount = noShowCount;
  else if (!unavailable) metrics.noShowCount = null;
  const periodLabel = asSafeText(source.periodLabel) ?? asSafeText(source.scopeLabel);
  if (periodLabel) metrics.periodLabel = periodLabel;
  return metrics;
}

function adaptAllowedActions(value: unknown): AdminCustomerAllowedActions {
  const source = isRecord(value) ? value : {};
  const read = (key: string, ...alts: string[]) => {
    if (readBoolean(source[key]) === true) return true;
    for (const alt of alts) {
      if (readBoolean(source[alt]) === true) return true;
    }
    return undefined;
  };
  return {
    view: read("view"),
    edit: read("edit", "manage"),
    create: read("create"),
    viewFullPhone: read("viewFullPhone", "phone"),
    viewFullEmail: read("viewFullEmail", "email"),
    copyContact: read("copyContact", "copy"),
    editContact: read("editContact", "contact"),
    editContactOverride: read("editContactOverride", "overrideContact"),
    manageNotes: read("manageNotes", "notes"),
    manageTags: read("manageTags", "tags"),
    createTag: read("createTag"),
    viewPayments: read("viewPayments", "payments"),
    block: read("block"),
    unblock: read("unblock"),
    deactivate: read("deactivate"),
    activate: read("activate"),
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminCustomerCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsNotesAppend: readBoolean(source.supportsNotesAppend) !== false,
    supportsNotesEdit: readBoolean(source.supportsNotesEdit) === true,
    supportsTagCreate: readBoolean(source.supportsTagCreate) === true,
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsVerifiedContactOverride: readBoolean(source.supportsVerifiedContactOverride) === true,
  };
}

function adaptTags(value: unknown): AdminCustomerTagView[] {
  return asList(value, ["items", "tags"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = publicId(item.id) ?? publicId(item.tagId);
      const name = asSafeText(item.name) ?? asSafeText(item.label);
      if (!id || !name) return [];
      return [
        {
          id,
          name,
          color: readString(item.color),
          colorLabel: asSafeText(item.colorLabel),
        } satisfies AdminCustomerTagView,
      ];
    });
}

function adaptNotes(value: unknown): AdminCustomerNoteView[] {
  return asList(value, ["items", "notes"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = readString(item.id) ?? `note_${asSafeText(item.createdAt) ?? "unknown"}`;
      const body = asSafeText(item.body) ?? asSafeText(item.text) ?? asSafeText(item.note);
      if (!body) return [];
      return [
        {
          id,
          body,
          authorLabel: asSafeText(item.authorLabel) ?? asSafeText(item.authorName),
          createdAt: readString(item.createdAt),
          createdAtLabel: asSafeText(item.createdAtLabel),
        } satisfies AdminCustomerNoteView,
      ];
    });
}

function adaptUpcoming(value: unknown): AdminCustomerUpcomingAppointmentView | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const id = publicId(value.id) ?? publicId(value.appointmentId);
  const reference = readString(value.reference) ?? readString(value.appointmentReference) ?? id;
  const startsAt = readString(value.startsAt) ?? readString(value.startAt);
  if (!id || !reference || !startsAt) return undefined;
  return {
    id,
    reference,
    startsAt,
    timezone: readString(value.timezone),
    serviceName: asSafeText(value.serviceName),
    branchName: asSafeText(value.branchName),
    status: parseStatusKey(value.status) ?? ("confirmed" as StatusKey),
    detailHref: routes.admin.appointmentDetail(reference),
  };
}

function adaptDuplicateMatches(value: unknown): AdminCustomerDuplicateMatch[] {
  return asList(value, ["items", "duplicates", "matches"])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = publicId(item.id) ?? publicId(item.customerId);
      const reference = readString(item.reference) ?? readString(item.customerReference) ?? id;
      const displayName =
        asSafeText(item.displayName) ??
        asSafeText(item.name) ??
        [asSafeText(item.firstName), asSafeText(item.lastName)].filter(Boolean).join(" ");
      if (!id || !reference || !displayName) return [];
      return [
        {
          id,
          reference,
          displayName,
          detailHref: adminCustomerDetailHref(reference),
          phoneMasked: asSafeText(item.phoneMasked),
        } satisfies AdminCustomerDuplicateMatch,
      ];
    });
}

function adaptFilterOptions(value: unknown): AdminCustomerFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const mapOptions = (items: unknown) =>
    asList(items, ["items"])
      .flatMap((item) => {
        if (!isRecord(item)) return [];
        const id = publicId(item.id);
        const name = asSafeText(item.name) ?? asSafeText(item.label);
        if (!id || !name) return [];
        return [{ id, name }];
      });
  const services = mapOptions(value.services);
  const branches = mapOptions(value.branches);
  const tags = mapOptions(value.tags);
  if (!services.length && !branches.length && !tags.length) return undefined;
  return {
    services: services.length ? services : undefined,
    branches: branches.length ? branches : undefined,
    tags: tags.length ? tags : undefined,
  };
}

function adaptListItem(value: unknown): AdminCustomerListItem | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id) ?? publicId(value.customerId);
  const reference = readString(value.reference) ?? readString(value.customerReference) ?? id;
  const displayName =
    asSafeText(value.displayName) ??
    asSafeText(value.name) ??
    [asSafeText(value.firstName), asSafeText(value.lastName)].filter(Boolean).join(" ");
  if (!id || !reference || !displayName) return null;

  const allowedActions = adaptAllowedActions(value.allowedActions);
  const lifecycle = adaptAdminCustomerLifecycle(value.lifecycle ?? value.status ?? value.active);
  const lifecycleLabel =
    lifecycle !== "unknown"
      ? ADMIN_CUSTOMER_LIFECYCLE_LABELS[lifecycle]
      : (asSafeText(value.lifecycleLabel) ?? "نامشخص");

  return {
    id,
    reference,
    displayName,
    lifecycle,
    lifecycleLabel,
    contact: adaptContact(value.contact ?? value, allowedActions),
    nextAppointmentLabel:
      asSafeText(value.nextAppointmentLabel) ??
      asSafeText(value.nextAppointmentAtLabel) ??
      asSafeText(value.nextAppointment),
    lastVisitLabel: asSafeText(value.lastVisitLabel) ?? asSafeText(value.lastVisitAtLabel),
    metrics: adaptMetrics(value.metrics ?? value),
    tags: adaptTags(value.tags),
    detailHref: adminCustomerDetailHref(reference),
    editHref: adminCustomerEditHref(reference),
  };
}

export function adaptAdminCustomerList(payload: unknown, page: number): AdminCustomerListView {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { items: [], totalCount: 0, page, pageSize: 20, pageCount: 1 };
  }
  const list = asList(root.items ?? root.customers, ["items", "customers"]);
  const items = list.map(adaptListItem).filter((item): item is AdminCustomerListItem => Boolean(item));
  const totalCount = readNumber(root.totalCount) ?? readNumber(root.total) ?? items.length;
  const pageSize = readNumber(root.pageSize) ?? readNumber(root.limit) ?? 20;
  const pageCount = readNumber(root.pageCount) ?? Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    items,
    totalCount,
    page,
    pageSize,
    pageCount,
    emptyCatalog: readBoolean(root.emptyCatalog) === true,
    filtersApplied: readBoolean(root.filtersApplied) === true,
    filterOptions: adaptFilterOptions(root.filterOptions ?? root.filters),
  };
}

export function adaptAdminCustomerDetail(payload: unknown): AdminCustomerDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const listItem = adaptListItem(root);
  if (!listItem) return null;

  const allowedActions = adaptAllowedActions(root.allowedActions);
  const capabilities = adaptCapabilities(root.capabilities);
  const notesModelRaw = readString(root.notesModel)?.toLowerCase();
  const notesModel =
    notesModelRaw === "append" || notesModelRaw === "single" ? notesModelRaw : "unknown";
  const tagCatalog = adaptTags(
    root.availableTags ?? (isRecord(root.filterOptions) ? root.filterOptions.tags : undefined),
  );

  return {
    ...listItem,
    firstName: asSafeText(root.firstName),
    lastName: asSafeText(root.lastName),
    blockedReason: asSafeText(root.blockedReason),
    contact: adaptContact(root.contact ?? root, allowedActions),
    metrics: adaptMetrics(root.metrics ?? root),
    upcomingAppointment: adaptUpcoming(root.upcomingAppointment ?? root.nextAppointment),
    tags: adaptTags(root.tags),
    notes: adaptNotes(root.notes ?? root.internalNotes),
    notesModel,
    duplicateMatches: adaptDuplicateMatches(root.duplicateMatches ?? root.possibleDuplicates),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    allowedActions,
    capabilities,
    editHref: adminCustomerEditHref(listItem.reference),
    tagCatalog: tagCatalog.length ? tagCatalog : undefined,
  };
}

export function adaptAdminCustomerImpactPreview(
  payload: unknown,
  action: AdminCustomerImpactAction,
): AdminCustomerImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش تأثیر";
  const summary = asSafeText(root.summary) ?? asSafeText(root.message) ?? "";
  const effects = asList(root.effects ?? root.impacts, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  return {
    action,
    title,
    summary,
    effects,
    futureAppointmentCount:
      typeof root.futureAppointmentCount === "number"
        ? root.futureAppointmentCount
        : typeof root.affectedAppointmentCount === "number"
          ? root.affectedAppointmentCount
          : undefined,
    waitingListAffected: readBoolean(root.waitingListAffected) === true,
    pendingPaymentCount:
      typeof root.pendingPaymentCount === "number" ? root.pendingPaymentCount : undefined,
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    requiresReason: readBoolean(root.requiresReason) === true,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason) ?? asSafeText(root.reason),
  };
}

export function adaptAdminCustomerMutationResult(payload: unknown): AdminCustomerMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    readString(root.reference) ??
    readString(root.customerReference) ??
    publicId(root.id);
  if (!reference) return null;
  return {
    reference,
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
  };
}

export function adaptAdminCustomerPaymentHistory(payload: unknown, page: number): PaymentHistoryListView {
  return adaptPaymentHistoryList(payload, { status: "all", page });
}

export function adaptAdminCustomerFromManualBooking(
  customer: ReturnType<typeof adaptCustomerItem>,
): AdminCustomerDetailView | null {
  if (!customer) return null;
  const reference = customer.reference ?? customer.id;
  return {
    id: customer.id,
    reference,
    displayName: customer.displayName,
    lifecycle: "active",
    lifecycleLabel: ADMIN_CUSTOMER_LIFECYCLE_LABELS.active,
    contact: {
      phone: customer.phone,
      phoneMasked: customer.phoneMasked,
      email: customer.email,
      emailMasked: customer.emailMasked,
      canViewFullPhone: Boolean(customer.phone),
      canViewFullEmail: Boolean(customer.email),
    },
    metrics: { unavailable: true },
    tags: [],
    notes: [],
    notesModel: "unknown",
    duplicateMatches: [],
    allowedActions: { view: true, edit: true },
    capabilities: {},
    editHref: adminCustomerEditHref(reference),
  };
}

export function validateAdminCustomerForm(input: AdminCustomerFormInput): AdminCustomerFormErrors {
  const errors: AdminCustomerFormErrors = {};
  if (!input.firstName.trim()) errors.firstName = "نام را وارد کنید.";
  if (!input.lastName.trim()) errors.lastName = "نام خانوادگی را وارد کنید.";
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10) errors.phone = "شماره موبایل معتبر نیست.";
  if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = "ایمیل معتبر نیست.";
  }
  return errors;
}

/** CustomerCreateInternal; the mobile is fixed after creation and updates send only names and email. */
export function sanitizeAdminCustomerBody(input: AdminCustomerFormInput, mode: "create" | "update" = "create") {
  const body: Record<string, string> = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
  };
  if (mode === "create") body.mobile = toE164IranMobile(input.phone.trim());
  const email = input.email?.trim();
  if (email) body.email = email;
  return body;
}

export function formFromAdminCustomerDetail(detail?: AdminCustomerDetailView | null): AdminCustomerFormInput {
  return {
    firstName: detail?.firstName ?? detail?.displayName.split(" ")[0] ?? "",
    lastName: detail?.lastName ?? detail?.displayName.split(" ").slice(1).join(" ") ?? "",
    phone: detail?.contact.phone ?? detail?.contact.phoneMasked ?? "",
    email: detail?.contact.email ?? detail?.contact.emailMasked ?? "",
    version: detail?.version,
  };
}

export function isAdminCustomerConflict(error: { status?: number; code?: string }): boolean {
  return error.status === 409 || error.code?.includes("CONFLICT") === true || error.code?.includes("VERSION") === true;
}

export function adminCustomerConflictMessage(): string {
  return "نسخه مشتری تغییر کرده است. داده تازه بارگذاری شد — تغییرات ذخیره‌نشده از بین رفت.";
}

export function isDuplicateAdminCustomerError(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 409 &&
    (error.code?.includes("DUPLICATE") === true ||
      error.code?.includes("EXISTS") === true ||
      error.code?.includes("ALREADY") === true)
  );
}

export function adminCustomerDuplicateMessage(): string {
  return "مشتری با این مشخصات از قبل وجود دارد.";
}

export function formatAdminCustomerMetric(value: number | null | undefined, unavailable?: boolean): string {
  if (unavailable) return "—";
  if (value == null) return "نامشخص";
  return String(value);
}
