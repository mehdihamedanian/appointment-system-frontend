import {
  adminCouponDetailHref,
  adminCouponEditHref,
} from "@/lib/admin/coupon-filters";
import { adminCouponFiltersApplied } from "@/lib/admin/coupon-filters";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import {
  ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS,
  ADMIN_COUPON_LIFECYCLE_LABELS,
  ADMIN_COUPON_SERVICE_SCOPE_LABELS,
  type AdminCouponAllowedActions,
  type AdminCouponCapabilities,
  type AdminCouponDetailView,
  type AdminCouponDiscountType,
  type AdminCouponFilterOptions,
  type AdminCouponFormErrors,
  type AdminCouponFormInput,
  type AdminCouponImpactPreview,
  type AdminCouponLifecycle,
  type AdminCouponListFilters,
  type AdminCouponListItemView,
  type AdminCouponListView,
  type AdminCouponMutationResult,
  type AdminCouponRestrictionView,
  type AdminCouponServiceScope,
  type AdminCouponUsageHistoryItem,
  type AdminCouponUsageStats,
} from "@/types/admin-coupon";

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

function moneyOrPercentLabel(value: unknown, currency?: string): string | undefined {
  if (typeof value === "string") return asSafeText(value);
  if (isRecord(value)) {
    return asSafeText(value.label) ?? asSafeText(value.formatted) ?? asSafeText(value.amountLabel);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  return undefined;
}

export function adaptAdminCouponLifecycle(value: unknown): AdminCouponLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "draft") return "draft";
  if (raw === "scheduled") return "scheduled";
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "paused" || raw === "inactive") return "paused";
  if (raw === "expired") return "expired";
  if (raw === "exhausted" || raw === "depleted") return "exhausted";
  if (raw === "archived") return "archived";
  return "unknown";
}

function adaptDiscountType(value: unknown): AdminCouponDiscountType {
  const raw = readString(value)?.toLowerCase();
  if (raw === "percentage" || raw === "percent") return "percentage";
  return "fixed";
}

function adaptAllowedActions(value: unknown): AdminCouponAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    view: readBoolean(source.view) !== false,
    edit: readBoolean(source.edit) === true,
    create: readBoolean(source.create) === true,
    pause: readBoolean(source.pause) === true,
    activate: readBoolean(source.activate) === true,
    archive: readBoolean(source.archive) === true,
    delete: readBoolean(source.delete) === true,
    editCode: readBoolean(source.editCode) === true,
    editDiscount: readBoolean(source.editDiscount) !== false,
    editRestrictions: readBoolean(source.editRestrictions) !== false,
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminCouponCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsCustomerRestrictions: readBoolean(source.supportsCustomerRestrictions) === true,
    supportsBranchRestrictions: readBoolean(source.supportsBranchRestrictions) === true,
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsUsageHistory: readBoolean(source.supportsUsageHistory) === true,
    supportsDraft: readBoolean(source.supportsDraft) !== false,
  };
}

function adaptUsageStats(value: unknown): AdminCouponUsageStats {
  const source = isRecord(value) ? value : {};
  const stats: AdminCouponUsageStats = {};
  const confirmedUsage = readNumber(source.confirmedUsage ?? source.usageCount ?? source.used);
  if (typeof confirmedUsage === "number") stats.confirmedUsage = confirmedUsage;
  const totalUsageLimit = readNumber(source.totalUsageLimit ?? source.usageLimit);
  if (typeof totalUsageLimit === "number") stats.totalUsageLimit = totalUsageLimit;
  const perCustomerLimit = readNumber(source.perCustomerLimit ?? source.perCustomerUsageLimit);
  if (typeof perCustomerLimit === "number") stats.perCustomerLimit = perCustomerLimit;
  const remainingUsage = readNumber(source.remainingUsage);
  if (typeof remainingUsage === "number") stats.remainingUsage = remainingUsage;
  const uniqueCustomers = readNumber(source.uniqueCustomers);
  if (typeof uniqueCustomers === "number") stats.uniqueCustomers = uniqueCustomers;
  const totalDiscountedLabel = asSafeText(source.totalDiscountedLabel ?? source.discountedTotalLabel);
  if (totalDiscountedLabel) stats.totalDiscountedLabel = totalDiscountedLabel;
  const usageLimitLabel = asSafeText(source.usageLimitLabel);
  if (usageLimitLabel) stats.usageLimitLabel = usageLimitLabel;
  const periodLabel = asSafeText(source.periodLabel);
  if (periodLabel) stats.periodLabel = periodLabel;
  return stats;
}

function adaptRestrictions(value: unknown): AdminCouponRestrictionView {
  const source = isRecord(value) ? value : {};
  const scopeRaw = readString(source.serviceScope ?? source.servicesMode)?.toLowerCase();
  let serviceScope: AdminCouponServiceScope = "all";
  if (scopeRaw === "include" || scopeRaw === "included") serviceScope = "include";
  if (scopeRaw === "exclude" || scopeRaw === "excluded") serviceScope = "exclude";

  const serviceIds = asList(source, ["serviceIds", "services"]).map((item) => {
    if (typeof item === "string") return publicId(item);
    if (isRecord(item)) return publicId(item.id) ?? publicId(item.reference);
    return undefined;
  }).filter((id): id is string => Boolean(id));

  const serviceLabels = asList(source, ["serviceLabels", "services"]).map((item) => {
    if (isRecord(item)) return asSafeText(item.name) ?? asSafeText(item.label);
    return asSafeText(item);
  }).filter((label): label is string => Boolean(label));

  const branchIds = asList(source, ["branchIds", "branches"]).map((item) => {
    if (typeof item === "string") return publicId(item);
    if (isRecord(item)) return publicId(item.id) ?? publicId(item.reference);
    return undefined;
  }).filter((id): id is string => Boolean(id));

  const branchLabels = asList(source, ["branchLabels"]).map((item) => asSafeText(item)).filter(Boolean) as string[];

  const restrictions: AdminCouponRestrictionView = {
    serviceScope,
    serviceIds,
    serviceLabels,
    branchIds,
    branchLabels,
  };
  const minimumAmountLabel = moneyOrPercentLabel(source.minimumAmountLabel ?? source.minimumAmount);
  if (minimumAmountLabel) restrictions.minimumAmountLabel = minimumAmountLabel;
  const maximumDiscountLabel = moneyOrPercentLabel(source.maximumDiscountLabel ?? source.maxDiscount);
  if (maximumDiscountLabel) restrictions.maximumDiscountLabel = maximumDiscountLabel;
  const customerRestrictionLabel = asSafeText(source.customerRestrictionLabel);
  if (customerRestrictionLabel) restrictions.customerRestrictionLabel = customerRestrictionLabel;
  return restrictions;
}

function adaptUsageHistory(value: unknown): AdminCouponUsageHistoryItem[] {
  return asList(value, ["usageHistory", "history", "usages"]).map((entry, index) => {
    if (!isRecord(entry)) return null;
    const item: AdminCouponUsageHistoryItem = {
      id: readString(entry.id) ?? `usage-${index}`,
    };
    const usedAtLabel =
      asSafeText(entry.usedAtLabel) ??
      (readString(entry.usedAt) ? formatAppointmentParts(readString(entry.usedAt)!)?.label : undefined);
    if (usedAtLabel) item.usedAtLabel = usedAtLabel;
    const customerLabel = asSafeText(entry.customerLabel ?? entry.customerName);
    if (customerLabel) item.customerLabel = customerLabel;
    const appointmentReference = publicId(entry.appointmentReference ?? entry.appointmentId);
    if (appointmentReference) item.appointmentReference = appointmentReference;
    const discountLabel = moneyOrPercentLabel(entry.discountLabel ?? entry.discountAmountLabel);
    if (discountLabel) item.discountLabel = discountLabel;
    const statusLabel = asSafeText(entry.statusLabel ?? entry.status);
    if (statusLabel) item.statusLabel = statusLabel;
    return item;
  }).filter((item): item is AdminCouponUsageHistoryItem => Boolean(item));
}

function adaptFilterOptions(value: unknown): AdminCouponFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminCouponFilterOptions = {};
  const services = asList(value, ["services"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = publicId(item.id) ?? publicId(item.reference);
    const name = asSafeText(item.name);
    return id && name ? { id, name } : null;
  }).filter((item): item is { id: string; name: string } => Boolean(item));
  if (services.length > 0) options.services = services;
  const branches = asList(value, ["branches"]).map((item) => {
    if (!isRecord(item)) return null;
    const id = publicId(item.id) ?? publicId(item.reference);
    const name = asSafeText(item.name);
    return id && name ? { id, name } : null;
  }).filter((item): item is { id: string; name: string } => Boolean(item));
  if (branches.length > 0) options.branches = branches;
  return Object.keys(options).length > 0 ? options : undefined;
}

function splitDateTime(iso: string | undefined, timeZone?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = formatAppointmentParts(iso, timeZone);
  if (!parts) return { date: iso.slice(0, 10), time: "00:00" };
  const date = iso.slice(0, 10);
  const timeMatch = iso.match(/T(\d{2}:\d{2})/);
  return { date, time: timeMatch?.[1] ?? "00:00" };
}

export function adaptAdminCouponListItem(value: unknown): AdminCouponListItemView | null {
  if (!isRecord(value)) return null;
  const reference =
    publicId(value.reference) ?? publicId(value.id) ?? publicId(value.couponReference);
  const code = asSafeText(value.code) ?? asSafeText(value.couponCode);
  const title = asSafeText(value.title) ?? asSafeText(value.internalTitle) ?? asSafeText(value.name);
  if (!reference || !code || !title) return null;

  const discountType = adaptDiscountType(value.discountType ?? value.type);
  const discountValueLabel =
    moneyOrPercentLabel(value.discountValueLabel ?? value.discountLabel ?? value.discountValue) ??
    "—";
  const lifecycle = adaptAdminCouponLifecycle(value.lifecycle ?? value.status);
  const allowedActions = adaptAllowedActions(value.allowedActions);
  const timeZone = readString(value.timezone) ?? readString(value.timeZone);
  const startsAt = readString(value.startsAt);
  const endsAt = readString(value.endsAt);

  const item: AdminCouponListItemView = {
    reference,
    code,
    title,
    discountType,
    discountTypeLabel: ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS[discountType],
    discountValueLabel,
    lifecycle,
    lifecycleLabel: ADMIN_COUPON_LIFECYCLE_LABELS[lifecycle],
    detailHref: adminCouponDetailHref(reference),
    editHref: adminCouponEditHref(reference),
    canViewDetail: allowedActions.view !== false,
    canEdit: allowedActions.edit === true,
    canPause: allowedActions.pause === true,
    canActivate: allowedActions.activate === true,
  };

  const validityLabel = asSafeText(value.validityLabel);
  if (validityLabel) item.validityLabel = validityLabel;
  if (startsAt) item.startsAtLabel = formatAppointmentParts(startsAt, timeZone)?.label;
  if (endsAt) item.endsAtLabel = formatAppointmentParts(endsAt, timeZone)?.label;
  const timezoneLabel = asSafeText(value.timezoneLabel) ?? timeZone;
  if (timezoneLabel) item.timezoneLabel = timezoneLabel;

  const stats = adaptUsageStats(value.stats ?? value.usage ?? value);
  if (typeof stats.confirmedUsage === "number") {
    item.usageCountLabel = new Intl.NumberFormat("fa-IR").format(stats.confirmedUsage);
  }
  if (stats.usageLimitLabel) item.usageLimitLabel = stats.usageLimitLabel;
  else if (typeof stats.totalUsageLimit === "number") {
    item.usageLimitLabel = new Intl.NumberFormat("fa-IR").format(stats.totalUsageLimit);
  }

  return item;
}

export function adaptAdminCouponList(
  payload: unknown,
  filters: AdminCouponListFilters,
): AdminCouponListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const list = asList(root, ["items", "coupons", "results"]);
  const items = list
    .map((item) => adaptAdminCouponListItem(item))
    .filter((item): item is AdminCouponListItemView => Boolean(item));

  const page = readNumber(source.page) ?? filters.page;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const totalCount = readNumber(source.totalCount) ?? readNumber(source.total);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    (typeof pageCount === "number" && typeof page === "number" && pageCount > page);
  const filtersOn = adminCouponFiltersApplied(filters);
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

export function adaptAdminCouponDetail(payload: unknown): AdminCouponDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const listItem = adaptAdminCouponListItem(root);
  if (!listItem) return null;

  const allowedActions = adaptAllowedActions(root.allowedActions);
  const capabilities = adaptCapabilities(root.capabilities);
  const timeZone = readString(root.timezone) ?? readString(root.timeZone);
  const startsAt = readString(root.startsAt);
  const endsAt = readString(root.endsAt);
  const { date: startsDate, time: startsTime } = splitDateTime(startsAt, timeZone);
  const { date: endsDate, time: endsTime } = splitDateTime(endsAt, timeZone);

  const detail: AdminCouponDetailView = {
    ...listItem,
    internalDescription: asSafeText(root.internalDescription) ?? asSafeText(root.description),
    customerDescription: asSafeText(root.customerDescription) ?? asSafeText(root.publicDescription),
    restrictions: adaptRestrictions(root.restrictions ?? root),
    stats: adaptUsageStats(root.stats ?? root.usage ?? root),
    usageHistory: adaptUsageHistory(root),
    allowedActions,
    capabilities,
  };

  if (startsAt) detail.startsAt = startsAt;
  if (endsAt) detail.endsAt = endsAt;
  const serverStatusLabel = asSafeText(root.serverStatusLabel ?? root.authoritativeStatusLabel);
  if (serverStatusLabel) detail.serverStatusLabel = serverStatusLabel;
  const serverTimeLabel = asSafeText(root.serverTimeLabel);
  if (serverTimeLabel) detail.serverTimeLabel = serverTimeLabel;
  const ruleSummary = asSafeText(root.ruleSummary) ?? buildRuleSummary(detail);
  if (ruleSummary) detail.ruleSummary = ruleSummary;
  const version = readString(root.version) ?? readString(root.etag);
  if (version) detail.version = version;
  const createdAtLabel = asSafeText(root.createdAtLabel);
  if (createdAtLabel) detail.createdAtLabel = createdAtLabel;
  const updatedAtLabel = asSafeText(root.updatedAtLabel);
  if (updatedAtLabel) detail.updatedAtLabel = updatedAtLabel;
  const authorLabel = asSafeText(root.authorLabel);
  if (authorLabel) detail.authorLabel = authorLabel;

  void startsDate;
  void startsTime;
  void endsDate;
  void endsTime;

  return detail;
}

export function formFromAdminCouponDetail(
  detail?: AdminCouponDetailView | null,
): AdminCouponFormInput {
  const timeZone = detail?.timezoneLabel;
  const starts = splitDateTime(detail?.startsAt, timeZone);
  const ends = splitDateTime(detail?.endsAt, timeZone);
  return {
    code: detail?.code ?? "",
    title: detail?.title ?? "",
    internalDescription: detail?.internalDescription ?? "",
    customerDescription: detail?.customerDescription ?? "",
    discountType: detail?.discountType ?? "fixed",
    discountValue: detail?.discountValueLabel?.replace(/[^\d.%]/g, "") ? detail.discountValueLabel : "",
    maximumDiscount: detail?.restrictions.maximumDiscountLabel ?? "",
    minimumAmount: detail?.restrictions.minimumAmountLabel ?? "",
    startsAt: starts.date,
    startsTime: starts.time,
    endsAt: ends.date,
    endsTime: ends.time,
    totalUsageLimit:
      detail?.stats.totalUsageLimit !== undefined
        ? String(detail.stats.totalUsageLimit)
        : "",
    perCustomerLimit:
      detail?.stats.perCustomerLimit !== undefined
        ? String(detail.stats.perCustomerLimit)
        : "",
    serviceScope: detail?.restrictions.serviceScope ?? "all",
    serviceIds: detail?.restrictions.serviceIds ?? [],
    branchIds: detail?.restrictions.branchIds ?? [],
    draft: detail?.lifecycle === "draft",
  };
}

export function buildRuleSummary(input: {
  discountType: AdminCouponDiscountType;
  discountValueLabel: string;
  restrictions: AdminCouponRestrictionView;
  startsAtLabel?: string;
  endsAtLabel?: string;
  timezoneLabel?: string;
  stats: AdminCouponUsageStats;
}): string {
  const parts = [
    `${ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS[input.discountType]}: ${input.discountValueLabel}`,
    ADMIN_COUPON_SERVICE_SCOPE_LABELS[input.restrictions.serviceScope],
  ];
  if (input.startsAtLabel && input.endsAtLabel) {
    parts.push(`از ${input.startsAtLabel} تا ${input.endsAtLabel}`);
  }
  if (input.timezoneLabel) parts.push(`منطقه زمانی: ${input.timezoneLabel}`);
  if (input.restrictions.minimumAmountLabel) {
    parts.push(`حداقل مبلغ: ${input.restrictions.minimumAmountLabel}`);
  }
  if (input.restrictions.maximumDiscountLabel) {
    parts.push(`حداکثر تخفیف: ${input.restrictions.maximumDiscountLabel}`);
  }
  if (typeof input.stats.totalUsageLimit === "number") {
    parts.push(`سقف مصرف: ${new Intl.NumberFormat("fa-IR").format(input.stats.totalUsageLimit)}`);
  }
  return parts.join(" · ");
}

export function validateAdminCouponForm(input: AdminCouponFormInput): AdminCouponFormErrors {
  const errors: AdminCouponFormErrors = {};
  const code = input.code.trim();
  if (!code) errors.code = "کد کوپن الزامی است.";
  else if (code.length > 40) errors.code = "کد کوپن حداکثر ۴۰ کاراکتر است.";

  if (!input.title.trim()) errors.title = "عنوان داخلی الزامی است.";

  if (!input.discountValue.trim()) {
    errors.discountValue = "مقدار تخفیف الزامی است.";
  } else if (input.discountType === "percentage") {
    const n = Number(input.discountValue.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      errors.discountValue = "درصد باید بین ۱ تا ۱۰۰ باشد.";
    }
  }

  if (!input.startsAt) errors.startsAt = "تاریخ شروع الزامی است.";
  if (!input.endsAt) errors.endsAt = "تاریخ پایان الزامی است.";
  if (input.startsAt && input.endsAt) {
    const start = new Date(`${input.startsAt}T${input.startsTime || "00:00"}:00`);
    const end = new Date(`${input.endsAt}T${input.endsTime || "23:59"}:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      errors.endsAt = "پایان باید بعد از شروع باشد.";
    }
  }

  if (input.serviceScope !== "all" && input.serviceIds.length === 0) {
    errors.serviceIds = "حداقل یک خدمت انتخاب کنید.";
  }

  return errors;
}

export function sanitizeAdminCouponBody(input: AdminCouponFormInput, version?: string) {
  const body: Record<string, unknown> = {
    code: input.code.trim(),
    title: input.title.trim(),
    discountType: input.discountType,
    discountValue: input.discountValue.trim(),
    startsAt: `${input.startsAt}T${input.startsTime || "00:00"}:00`,
    endsAt: `${input.endsAt}T${input.endsTime || "23:59"}:00`,
    serviceScope: input.serviceScope,
    serviceIds: input.serviceScope === "all" ? [] : input.serviceIds,
    branchIds: input.branchIds,
    draft: input.draft,
  };
  if (input.internalDescription?.trim()) body.internalDescription = input.internalDescription.trim();
  if (input.customerDescription?.trim()) body.customerDescription = input.customerDescription.trim();
  if (input.maximumDiscount?.trim()) body.maximumDiscount = input.maximumDiscount.trim();
  if (input.minimumAmount?.trim()) body.minimumAmount = input.minimumAmount.trim();
  if (input.totalUsageLimit?.trim()) body.totalUsageLimit = input.totalUsageLimit.trim();
  if (input.perCustomerLimit?.trim()) body.perCustomerLimit = input.perCustomerLimit.trim();
  if (version) body.version = version;
  return body;
}

export function adaptAdminCouponImpactPreview(payload: unknown): AdminCouponImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش اثر";
  const preview: AdminCouponImpactPreview = {
    title,
    effects: asList(root, ["effects", "items"]).map((item) => asSafeText(item)).filter(Boolean) as string[],
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
  };
  const summary = asSafeText(root.summary) ?? asSafeText(root.description);
  if (summary) preview.summary = summary;
  if (readBoolean(root.existingBookingsUnchanged) === true) {
    preview.existingBookingsUnchanged = true;
  }
  const confirmLabel = asSafeText(root.confirmLabel);
  if (confirmLabel) preview.confirmLabel = confirmLabel;
  const previewVersion = readString(root.previewVersion) ?? readString(root.version);
  if (previewVersion) preview.previewVersion = previewVersion;
  if (readBoolean(root.blocked) === true) preview.blocked = true;
  const blockedReason = asSafeText(root.blockedReason);
  if (blockedReason) preview.blockedReason = blockedReason;
  return preview;
}

export function adaptAdminCouponMutationResult(payload: unknown): AdminCouponMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference =
    publicId(root.reference) ?? publicId(root.couponReference) ?? publicId(root.id);
  if (!reference) return null;
  const result: AdminCouponMutationResult = { reference };
  const version = readString(root.version) ?? readString(root.etag);
  if (version) result.version = version;
  return result;
}

export function isAdminCouponConflict(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 409 ||
    error.code?.includes("CONFLICT") === true ||
    error.code?.includes("VERSION") === true
  );
}

export function isDuplicateCouponError(error: { status?: number; code?: string }): boolean {
  return (
    error.status === 409 ||
    error.code?.includes("DUPLICATE") === true ||
    error.code?.includes("EXISTS") === true ||
    error.code?.includes("COUPON_CODE") === true
  );
}

export function adminCouponConflictMessage(): string {
  return "کوپن توسط کاربر دیگری تغییر کرده است. لطفاً صفحه را به‌روز کنید.";
}

export function adminCouponDuplicateMessage(): string {
  return "این کد کوپن قبلاً ثبت شده است.";
}
