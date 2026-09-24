import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  adaptServiceDeposit,
  adaptServiceListItem,
  adaptServicePrice,
} from "@/lib/public/service-adapters";
import { isRecord, readString } from "@/lib/utilities/records";
import { routes } from "@/constants/routes";
import {
  ADMIN_SERVICE_DEPOSIT_MODE_LABELS,
  ADMIN_SERVICE_LIFECYCLE_LABELS,
  ADMIN_SERVICE_PROVIDER_MODE_LABELS,
  type AdminServiceAllowedActions,
  type AdminServiceBranchAssignment,
  type AdminServiceCapabilities,
  type AdminServiceDepositMode,
  type AdminServiceDetailView,
  type AdminServiceFilterOptions,
  type AdminServiceFormInput,
  type AdminServiceImpactPreview,
  type AdminServiceLifecycle,
  type AdminServiceListItem,
  type AdminServiceListView,
  type AdminServiceMutationResult,
  type AdminServicePricingView,
  type AdminServiceProviderAssignment,
  type AdminServiceProviderMode,
} from "@/types/admin-service";
import type { ServiceListItemView } from "@/types/service";

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

function readInteger(value: unknown): number | undefined {
  const n = readNumber(value);
  if (n === undefined || !Number.isInteger(n)) return undefined;
  return n;
}

export function adaptAdminServiceLifecycle(value: unknown): AdminServiceLifecycle {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "active" || raw === "enabled") return "active";
  if (raw === "inactive" || raw === "disabled") return "inactive";
  if (raw === "archived" || raw === "archive") return "archived";
  if (readBoolean(value) === true) return "active";
  if (readBoolean(value) === false) return "inactive";
  return "unknown";
}

function adaptDepositMode(value: unknown): AdminServiceDepositMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "none" || raw === "no_deposit") return "none";
  if (raw === "fixed" || raw === "amount") return "fixed";
  if (raw === "percentage" || raw === "percent") return "percentage";
  if (readBoolean(value) === false) return "none";
  return "none";
}

function adaptProviderMode(value: unknown): AdminServiceProviderMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "selectable" || raw === "customer_selectable" || raw === "customer") {
    return "selectable";
  }
  if (raw === "auto" || raw === "automatic" || raw === "assigned") return "auto";
  if (raw === "none" || raw === "hidden" || raw === "internal") return "none";
  return "unknown";
}

function adaptAllowedActions(value: unknown): AdminServiceAllowedActions {
  if (!isRecord(value)) return { view: true, edit: true };
  const source = isRecord(value.allowedActions) ? value.allowedActions : value;
  const read = (key: string, ...alts: string[]) => {
    if (readBoolean(source[key]) === true) return true;
    for (const alt of alts) {
      if (readBoolean(source[alt]) === true) return true;
    }
    return undefined;
  };
  return {
    view: read("view", "canView") ?? true,
    edit: read("edit", "canEdit", "update"),
    editContent: read("editContent", "canEditContent", "content"),
    managePricing: read("managePricing", "canManagePricing", "pricing"),
    manageProviders: read("manageProviders", "canManageProviders", "providers"),
    manageResources: read("manageResources", "canManageResources", "resources"),
    manageBranches: read("manageBranches", "canManageBranches", "branches"),
    changeStatus: read("changeStatus", "canChangeStatus", "status"),
    activate: read("activate", "canActivate"),
    deactivate: read("deactivate", "canDeactivate"),
    archive: read("archive", "canArchive"),
    delete: read("delete", "canDelete"),
    reorder: read("reorder", "canReorder"),
    uploadImage: read("uploadImage", "canUploadImage", "imageUpload"),
    viewPreview: read("viewPreview", "canViewPreview", "preview") ?? true,
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminServiceCapabilities {
  const source = isRecord(value) ? (isRecord(value.capabilities) ? value.capabilities : value) : {};
  const readCap = (key: string, defaultValue = true) =>
    readBoolean(source[key]) !== false && defaultValue;
  return {
    hasMultiBranch: readBoolean(source.hasMultiBranch) === true,
    hasProviderAssignment: readCap("hasProviderAssignment"),
    hasResourceRequirements: readCap("hasResourceRequirements"),
    hasImageUpload: readCap("hasImageUpload"),
    hasPricing: readCap("hasPricing"),
    hasDeposit: readCap("hasDeposit"),
    hasCapacity: readCap("hasCapacity"),
    hasBuffers: readCap("hasBuffers"),
    hasSortOrder: readCap("hasSortOrder"),
    hasCategories: readBoolean(source.hasCategories) === true,
    hasImpactPreview: readBoolean(source.hasImpactPreview) !== false,
    atomicSave: readBoolean(source.atomicSave) !== false,
  };
}

function adaptBranches(value: unknown): AdminServiceBranchAssignment[] {
  return asList(value, ["items", "branches"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.branchId);
      const name = asSafeText(item.name) ?? asSafeText(item.branchName);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is AdminServiceBranchAssignment => Boolean(item));
}

function adaptProviders(value: unknown): AdminServiceProviderAssignment[] {
  return asList(value, ["items", "providers"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id) ?? publicId(item.providerId) ?? publicId(item.staffId);
      const name = asSafeText(item.name) ?? asSafeText(item.displayName);
      if (!id || !name) return null;
      const assignment: AdminServiceProviderAssignment = { id, name };
      if (readBoolean(item.customerVisible) === true) {
        assignment.customerVisible = true;
      }
      return assignment;
    })
    .filter((item): item is AdminServiceProviderAssignment => Boolean(item));
}

function adaptPricing(source: Record<string, unknown>, currency?: string): AdminServicePricingView {
  const priceView = adaptServicePrice(source, currency);
  const depositView = adaptServiceDeposit(source, currency);
  const depositMode = adaptDepositMode(
    source.depositMode ?? source.depositType ?? source.depositKind,
  );
  let resolvedDepositMode = depositMode;
  if (depositView?.kind === "percentage") resolvedDepositMode = "percentage";
  else if (depositView?.kind === "fixed") resolvedDepositMode = "fixed";
  else if (depositView?.kind === "none") resolvedDepositMode = "none";

  return {
    priceMode: priceView.kind,
    priceLabel: priceView.label,
    price: readInteger(source.price) ?? readInteger(source.amount),
    currency: readString(source.currency) ?? currency,
    depositMode: resolvedDepositMode,
    depositLabel: depositView?.label,
    depositAmount: readInteger(source.depositAmount) ?? readInteger(source.deposit),
    depositPercent:
      readInteger(source.depositPercent) ?? readInteger(source.depositPercentage),
  };
}

function adaptRequirementSummary(value: unknown): string[] | undefined {
  const lines = asList(value, ["summaryLines", "items", "lines"])
    .map((item) => (typeof item === "string" ? asSafeText(item) : undefined))
    .filter((item): item is string => Boolean(item));
  return lines.length ? lines : undefined;
}

function serviceReferenceFrom(value: Record<string, unknown>): string | undefined {
  return readString(value.reference) ?? readString(value.serviceReference) ?? publicId(value.id);
}

function adaptListItem(value: unknown): AdminServiceListItem | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id) ?? publicId(value.serviceId);
  const reference = serviceReferenceFrom(value) ?? id;
  const name = asSafeText(value.name) ?? asSafeText(value.title);
  if (!id || !reference || !name) return null;

  const lifecycle = adaptAdminServiceLifecycle(
    value.lifecycle ?? value.status ?? value.active ?? value.state,
  );
  const currency = readString(value.currency);
  const imageUrl = asSafeText(value.imageUrl) ?? asSafeText(value.image);
  const branches = adaptBranches(value.branches ?? value.branchAssignments);
  const providerCount =
    readInteger(value.providerCount) ??
    (Array.isArray(value.providers) ? value.providers.length : adaptProviders(value.providers).length);

  return {
    id,
    reference,
    name,
    image: imageUrl ? { imageUrl, alt: name } : undefined,
    durationMinutes: readInteger(value.durationMinutes) ?? readInteger(value.duration),
    pricing: adaptPricing(value, currency),
    capacity: readInteger(value.capacity) ?? readInteger(value.serviceCapacity),
    branches,
    providerCount,
    requirementSummary: adaptRequirementSummary(
      value.requirementSummary ?? value.resourceRequirementsSummary,
    ),
    lifecycle,
    lifecycleLabel:
      lifecycle === "unknown"
        ? "نامشخص"
        : ADMIN_SERVICE_LIFECYCLE_LABELS[lifecycle],
    sortOrder: readInteger(value.sortOrder) ?? readInteger(value.order),
    bookingEnabled: readBoolean(value.bookingEnabled) !== false,
    detailHref: routes.admin.serviceDetail(reference),
    editHref: routes.admin.serviceEdit(reference),
    resourcesHref: routes.admin.serviceResources(reference),
    allowedActions: adaptAllowedActions(value),
  };
}

function adaptFilterOptions(value: unknown): AdminServiceFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const source = isRecord(value.filterOptions) ? value.filterOptions : value;
  const branches = adaptBranches(source.branches).map((b) => ({ id: b.id, name: b.name }));
  const providers = adaptProviders(source.providers).map((p) => ({ id: p.id, name: p.name }));
  const resourceTypes = asList(source.resourceTypes, ["items"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const val = readString(item.value) ?? readString(item.type);
      const label = asSafeText(item.label) ?? asSafeText(item.name);
      if (!val || !label) return null;
      return { value: val, label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  const categories = asList(source.categories, ["items"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = publicId(item.id);
      const name = asSafeText(item.name);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is { id: string; name: string } => Boolean(item));

  if (!branches.length && !providers.length && !resourceTypes.length && !categories.length) {
    return undefined;
  }
  return {
    branches: branches.length ? branches : undefined,
    providers: providers.length ? providers : undefined,
    resourceTypes: resourceTypes.length ? resourceTypes : undefined,
    categories: categories.length ? categories : undefined,
  };
}

export function adaptAdminServiceList(payload: unknown, page: number): AdminServiceListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(source, ["items", "services"])
    .map((item) => adaptListItem(item))
    .filter((item): item is AdminServiceListItem => Boolean(item));

  const totalCount = readInteger(source.totalCount) ?? readInteger(source.total);
  const pageCount =
    readInteger(source.pageCount) ??
    (totalCount !== undefined ? Math.max(1, Math.ceil(totalCount / 20)) : undefined);
  const hasMore = readBoolean(source.hasMore) === true;

  return {
    items,
    page,
    pageCount,
    totalCount,
    hasMore,
    filtersApplied: readBoolean(source.filtersApplied) === true,
    emptyCatalog: readBoolean(source.emptyCatalog) === true || items.length === 0,
    filterOptions: adaptFilterOptions(source),
  };
}

export function adaptAdminServiceDetail(payload: unknown): AdminServiceDetailView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;

  const item = adaptListItem(root);
  if (!item) return null;

  const providerMode = adaptProviderMode(
    root.providerMode ?? root.providerSelection ?? root.providerBehavior,
  );
  const categoryId = publicId(root.categoryId) ?? (isRecord(root.category) ? publicId(root.category.id) : undefined);
  const categoryName =
    asSafeText(root.categoryName) ??
    (isRecord(root.category) ? asSafeText(root.category.name) : undefined);
  const slug = readString(root.slug);

  return {
    ...item,
    slug,
    shortDescription: asSafeText(root.shortDescription) ?? asSafeText(root.excerpt),
    description: asSafeText(root.description),
    bufferBeforeMinutes:
      readInteger(root.bufferBeforeMinutes) ?? readInteger(root.bufferBefore),
    bufferAfterMinutes: readInteger(root.bufferAfterMinutes) ?? readInteger(root.bufferAfter),
    capacityLabel: asSafeText(root.capacityLabel),
    capacityHelp: asSafeText(root.capacityHelp),
    providers: adaptProviders(root.providers ?? root.providerAssignments),
    providerMode,
    providerModeLabel:
      providerMode === "unknown" ? undefined : ADMIN_SERVICE_PROVIDER_MODE_LABELS[providerMode],
    categoryId,
    categoryName,
    customerPreviewActive: item.lifecycle === "active" && item.bookingEnabled,
    publicHref: slug ? routes.public.serviceDetail(slug) : routes.public.serviceDetail(item.id),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    capabilities: adaptCapabilities(root),
  };
}

export function adaptAdminServiceImpactPreview(payload: unknown): AdminServiceImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const effects = asList(root.effects ?? root.warnings, ["items"])
    .map((item) =>
      typeof item === "string"
        ? asSafeText(item)
        : isRecord(item)
          ? asSafeText(item.message) ?? asSafeText(item.label)
          : undefined,
    )
    .filter((item): item is string => Boolean(item));
  const actionRaw = readString(root.action)?.toLowerCase();
  return {
    action:
      actionRaw === "activate" ||
      actionRaw === "deactivate" ||
      actionRaw === "archive" ||
      actionRaw === "delete"
        ? actionRaw
        : undefined,
    title: asSafeText(root.title) ?? "تأیید تغییر",
    summary:
      asSafeText(root.summary) ??
      asSafeText(root.message) ??
      "این تغییر ممکن است روی دسترس‌پذیری و نوبت‌های آینده اثر بگذارد.",
    effects,
    futureAppointmentCount: readInteger(root.futureAppointmentCount),
    waitingListCount: readInteger(root.waitingListCount),
    availabilityAffected: readBoolean(root.availabilityAffected) === true,
    branchWarnings: asList(root.branchWarnings, ["items"])
      .map((item) => (typeof item === "string" ? asSafeText(item) : undefined))
      .filter((item): item is string => Boolean(item)),
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason),
  };
}

export function adaptAdminServiceMutationResult(
  payload: unknown,
): AdminServiceMutationResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const reference = serviceReferenceFrom(root);
  if (!reference) return null;
  return {
    reference,
    version: readString(root.version),
    updatedAt: readString(root.updatedAt),
  };
}

export function formFromAdminServiceDetail(detail?: AdminServiceDetailView | null): AdminServiceFormInput {
  return {
    name: detail?.name ?? "",
    slug: detail?.slug,
    shortDescription: detail?.shortDescription ?? "",
    description: detail?.description ?? "",
    durationMinutes: detail?.durationMinutes,
    bufferBeforeMinutes: detail?.bufferBeforeMinutes,
    bufferAfterMinutes: detail?.bufferAfterMinutes,
    capacity: detail?.capacity,
    priceMode: detail?.pricing.priceMode ?? "hidden",
    price: detail?.pricing.price,
    currency: detail?.pricing.currency,
    depositMode: detail?.pricing.depositMode ?? "none",
    depositAmount: detail?.pricing.depositAmount,
    depositPercent: detail?.pricing.depositPercent,
    branchIds: detail?.branches.map((b) => b.id) ?? [],
    providerIds: detail?.providers.map((p) => p.id) ?? [],
    providerMode: detail?.providerMode === "unknown" ? "auto" : detail?.providerMode ?? "auto",
    categoryId: detail?.categoryId,
    sortOrder: detail?.sortOrder,
    bookingEnabled: detail?.bookingEnabled ?? true,
    version: detail?.version,
  };
}

export function sanitizeAdminServiceBody(input: AdminServiceFormInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    slug: input.slug?.trim() || undefined,
    shortDescription: input.shortDescription?.trim() || undefined,
    description: input.description?.trim() || undefined,
    durationMinutes: input.durationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    capacity: input.capacity,
    priceType: input.priceMode === "hidden" ? "hidden" : input.priceMode,
    price: input.priceMode === "fixed" || input.priceMode === "startingFrom" ? input.price : undefined,
    currency: input.currency,
    depositType: input.depositMode,
    depositAmount: input.depositMode === "fixed" ? input.depositAmount : undefined,
    depositPercent: input.depositMode === "percentage" ? input.depositPercent : undefined,
    branchIds: input.branchIds.length ? input.branchIds : undefined,
    providerIds: input.providerIds.length ? input.providerIds : undefined,
    providerMode: input.providerMode === "unknown" ? undefined : input.providerMode,
    categoryId: input.categoryId,
    sortOrder: input.sortOrder,
    bookingEnabled: input.bookingEnabled,
    version: input.version,
  };
}

export type AdminServiceFormErrors = Partial<
  Record<
    | keyof AdminServiceFormInput
    | "form"
    | "name"
    | "durationMinutes"
    | "price"
    | "depositAmount"
    | "depositPercent"
    | "capacity",
    string
  >
>;

export function validateAdminServiceForm(
  input: AdminServiceFormInput,
  options: { requirePricing?: boolean } = {},
): AdminServiceFormErrors {
  const errors: AdminServiceFormErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "نام خدمت را وارد کنید.";
  else if (name.length > 120) errors.name = "نام خدمت حداکثر ۱۲۰ کاراکتر است.";

  if (input.shortDescription && input.shortDescription.trim().length > 240) {
    errors.shortDescription = "توضیح کوتاه حداکثر ۲۴۰ کاراکتر است.";
  }
  if (input.description && input.description.trim().length > 4000) {
    errors.description = "توضیح کامل حداکثر ۴۰۰۰ کاراکتر است.";
  }

  if (input.durationMinutes !== undefined) {
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
      errors.durationMinutes = "مدت باید عدد صحیح ≥ ۱ دقیقه باشد.";
    }
  }

  for (const [field, value] of [
    ["bufferBeforeMinutes", input.bufferBeforeMinutes],
    ["bufferAfterMinutes", input.bufferAfterMinutes],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      errors[field] = "بافر باید عدد صحیح ≥ ۰ باشد.";
    }
  }

  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    errors.capacity = "ظرفیت باید عدد صحیح ≥ ۱ باشد.";
  }

  if (options.requirePricing !== false) {
    if (
      (input.priceMode === "fixed" || input.priceMode === "startingFrom") &&
      (input.price === undefined || !Number.isInteger(input.price) || input.price < 0)
    ) {
      errors.price = "قیمت باید عدد صحیح ≥ ۰ باشد.";
    }
    if (
      input.depositMode === "fixed" &&
      (input.depositAmount === undefined ||
        !Number.isInteger(input.depositAmount) ||
        input.depositAmount < 0)
    ) {
      errors.depositAmount = "مبلغ بیعانه باید عدد صحیح ≥ ۰ باشد.";
    }
    if (
      input.depositMode === "percentage" &&
      (input.depositPercent === undefined ||
        !Number.isInteger(input.depositPercent) ||
        input.depositPercent < 1 ||
        input.depositPercent > 100)
    ) {
      errors.depositPercent = "درصد بیعانه باید بین ۱ تا ۱۰۰ باشد.";
    }
  }

  return errors;
}

/** Map admin form/detail to customer preview — excludes internal operational data. */
export function adminServiceToCustomerPreview(
  input: AdminServiceFormInput | AdminServiceDetailView,
  currency = "IRR",
): ServiceListItemView {
  const name = "name" in input ? input.name : "";
  const shortDescription =
    "shortDescription" in input ? input.shortDescription : undefined;
  const durationMinutes =
    "durationMinutes" in input ? input.durationMinutes : undefined;
  const bookingEnabled = "bookingEnabled" in input ? input.bookingEnabled : true;
  const lifecycle =
    "lifecycle" in input ? input.lifecycle : input.bookingEnabled ? "active" : "inactive";

  const imageUrl =
    "image" in input && input.image?.imageUrl
      ? input.image.imageUrl
      : undefined;

  const pricingSource: Record<string, unknown> =
    "pricing" in input
      ? {
          priceType: input.pricing.priceMode,
          priceLabel: input.pricing.priceLabel,
          price: input.pricing.price,
          currency: input.pricing.currency ?? currency,
          depositType: input.pricing.depositMode,
          depositAmount: input.pricing.depositAmount,
          depositPercent: input.pricing.depositPercent,
          depositLabel: input.pricing.depositLabel,
        }
      : {
          priceType: input.priceMode,
          price: input.price,
          currency: input.currency ?? currency,
          depositType: input.depositMode,
          depositAmount: input.depositAmount,
          depositPercent: input.depositPercent,
        };

  const id = "id" in input ? input.id : "preview";
  const availability =
    lifecycle === "archived"
      ? "archived"
      : lifecycle === "inactive"
        ? "inactive"
        : bookingEnabled
          ? "bookable"
          : "bookingDisabled";

  const adapted = adaptServiceListItem(
    {
      id,
      name: name.trim() || "پیش‌نمایش خدمت",
      shortDescription,
      imageUrl,
      durationMinutes,
      bookingEnabled,
      lifecycle,
      active: lifecycle === "active",
      ...pricingSource,
    },
    currency,
  );

  return (
    adapted ?? {
      id: "preview",
      name: name.trim() || "پیش‌نمایش خدمت",
      shortDescription,
      imageUrl,
      durationMinutes,
      pricing: adaptServicePrice(pricingSource, currency),
      deposit: adaptServiceDeposit(pricingSource, currency),
      bookingEnabled,
      availability,
    }
  );
}

export function isAdminServiceConflict(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("STALE");
}

export function isDuplicateServiceError(error: { status?: number; code?: string }): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("DUPLICATE") || code.includes("SLUG") || code.includes("NAME");
}

export function adminServiceConflictMessage(): string {
  return "این خدمت توسط فرد دیگری به‌روزرسانی شده است. لطفاً آخرین نسخه را بررسی کنید.";
}

export function adminServiceDuplicateMessage(): string {
  return "خدمتی با این نام یا نشانی (slug) قبلاً ثبت شده است.";
}

export function depositModeLabel(mode: AdminServiceDepositMode): string {
  return ADMIN_SERVICE_DEPOSIT_MODE_LABELS[mode];
}
