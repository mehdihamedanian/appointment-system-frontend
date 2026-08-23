import { isRecord, readString } from "@/lib/utilities/records";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import { formatCurrencyAmount } from "@/lib/date-time/format";
import {
  isExplicitlyInactive,
  isExplicitlyPrivate,
  isInternalResource,
  readId,
} from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { adaptPublicBranches, adaptPublicProviders } from "@/lib/public/adapters";
import { adaptAdditionalFields } from "@/lib/booking/adapters";
import type { PublicBranch, PublicProvider, PublicService } from "@/types/public";
import type {
  ServiceAvailability,
  ServiceCatalogView,
  ServiceCategoryView,
  ServiceDepositView,
  ServiceDetailView,
  ServiceListItemView,
  ServicePriceKind,
  ServicePriceView,
} from "@/types/service";

function integerAmount(value: unknown): number | undefined {
  const amount = readNumber(value);
  if (amount === undefined || !Number.isInteger(amount)) {
    return undefined;
  }
  return amount;
}

function formatIntegerMoney(amount: number, currency?: string): string | undefined {
  return formatCurrencyAmount(amount, currency);
}

export function adaptServicePrice(
  source: Record<string, unknown>,
  currency?: string,
): ServicePriceView {
  const visibility = readString(source.priceVisibility)?.toLowerCase();
  const priceType = (
    readString(source.priceType) ??
    readString(source.pricingType) ??
    readString(source.priceMode) ??
    ""
  ).toLowerCase();

  if (
    readBoolean(source.priceHidden) === true ||
    visibility === "hidden" ||
    visibility === "private" ||
    priceType === "hidden"
  ) {
    return { kind: "hidden", label: "قیمت اعلام نمی‌شود" };
  }

  if (
    readBoolean(source.contactForPrice) === true ||
    priceType === "contact" ||
    priceType === "on_request" ||
    priceType === "inquire"
  ) {
    return { kind: "contact", label: "برای اطلاع از هزینه با مجموعه تماس بگیرید" };
  }

  if (readBoolean(source.isFree) === true || priceType === "free") {
    return { kind: "free", label: "رایگان" };
  }

  const labeled =
    asSafeText(source.priceLabel) ??
    asSafeText(source.priceDisplay) ??
    asSafeText(source.formattedPrice) ??
    asSafeText(source.startingPriceLabel);

  const starting =
    priceType === "starting" ||
    priceType === "from" ||
    priceType === "starting_from" ||
    readBoolean(source.startingFrom) === true ||
    source.startingPriceLabel != null;

  if (labeled) {
    const kind: ServicePriceKind = starting ? "startingFrom" : "fixed";
    if (kind === "startingFrom" && !/از|شروع/.test(labeled)) {
      return { kind, label: `شروع از ${labeled}` };
    }
    if (labeled.includes("رایگان")) {
      return { kind: "free", label: labeled };
    }
    return { kind, label: labeled };
  }

  const amount =
    integerAmount(source.price) ??
    integerAmount(source.amount) ??
    integerAmount(source.startingPrice) ??
    integerAmount(source.fromPrice);
  const code = readString(source.currency) ?? currency;
  if (amount === 0) {
    return { kind: "free", label: "رایگان" };
  }
  if (amount !== undefined) {
    const formatted = formatIntegerMoney(amount, code);
    if (formatted) {
      return starting
        ? { kind: "startingFrom", label: `شروع از ${formatted}` }
        : { kind: "fixed", label: formatted };
    }
  }

  return { kind: "hidden", label: "قیمت اعلام نشده" };
}

export function adaptServiceDeposit(
  source: Record<string, unknown>,
  currency?: string,
): ServiceDepositView | undefined {
  const type = (
    readString(source.depositType) ??
    readString(source.depositKind) ??
    ""
  ).toLowerCase();

  if (
    readBoolean(source.payAtLocation) === true ||
    type === "pay_at_location" ||
    type === "on_site"
  ) {
    return { kind: "payAtLocation", label: "پرداخت در محل" };
  }

  if (
    readBoolean(source.fullPaymentRequired) === true ||
    type === "full" ||
    type === "full_payment"
  ) {
    return { kind: "full", label: "پرداخت کامل هنگام رزرو" };
  }

  if (readBoolean(source.depositRequired) === false || type === "none") {
    return { kind: "none", label: "بدون بیعانه" };
  }

  const labeled = asSafeText(source.depositLabel) ?? asSafeText(source.formattedDeposit);
  const percent = integerAmount(source.depositPercent) ?? integerAmount(source.depositPercentage);
  if (type === "percentage" || percent !== undefined) {
    if (labeled) {
      return { kind: "percentage", label: labeled };
    }
    if (percent !== undefined) {
      return { kind: "percentage", label: `${percent}٪ بیعانه` };
    }
  }

  const amount = integerAmount(source.depositAmount) ?? integerAmount(source.deposit);
  if (type === "fixed" || amount !== undefined) {
    if (labeled) {
      return { kind: "fixed", label: labeled };
    }
    const code = readString(source.depositCurrency) ?? readString(source.currency) ?? currency;
    if (amount !== undefined) {
      const formatted = formatIntegerMoney(amount, code);
      if (formatted) {
        return { kind: "fixed", label: `بیعانه ${formatted}` };
      }
    }
  }

  if (labeled) {
    return { kind: "fixed", label: labeled };
  }

  return undefined;
}

function adaptCategory(value: unknown): ServiceCategoryView | undefined {
  if (typeof value === "string") {
    const name = asSafeText(value);
    if (!name || !isSafePublicId(name)) {
      return undefined;
    }
    return { id: name, name };
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const id =
    readString(value.id) ??
    readString(value.slug) ??
    readString(value.publicId);
  const name = asSafeText(value.name) ?? asSafeText(value.title) ?? id;
  if (!id || !name || !isSafePublicId(id)) {
    return undefined;
  }
  return { id, name };
}

function adaptAvailability(
  source: Record<string, unknown>,
  bookingEnabled: boolean,
): ServiceAvailability {
  const status = readString(source.status)?.toLowerCase();
  if (status === "archived") {
    return "archived";
  }
  if (status === "inactive" || status === "disabled" || readBoolean(source.active) === false) {
    return "inactive";
  }
  if (
    readBoolean(source.temporarilyUnavailable) === true ||
    status === "unavailable" ||
    status === "temporarily_unavailable"
  ) {
    return "unavailable";
  }
  if (!bookingEnabled) {
    return "bookingDisabled";
  }
  return "bookable";
}

export function adaptServiceListItem(
  value: unknown,
  currency?: string,
  options: { allowInactive?: boolean } = {},
): ServiceListItemView | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isInternalResource(value)) {
    return null;
  }
  if (!options.allowInactive && isExplicitlyInactive(value)) {
    return null;
  }
  if (isExplicitlyPrivate(value)) {
    return null;
  }

  const id = readId(value);
  const name = asSafeText(value.name) ?? asSafeText(value.title);
  if (!id || !name) {
    return null;
  }

  const bookingEnabled =
    readBoolean(value.bookingEnabled) ??
    readBoolean(value.bookable) ??
    true;
  const availability = adaptAvailability(value, bookingEnabled);
  const deposit = adaptServiceDeposit(value, currency);

  return {
    id,
    slug: isSafePublicId(readString(value.slug)) ? readString(value.slug) : undefined,
    name,
    shortDescription:
      asSafeText(value.shortDescription) ??
      asSafeText(value.summary),
    imageUrl: readUrl(value.imageUrl ?? value.image ?? value.coverImage),
    durationMinutes: integerAmount(value.durationMinutes) ?? integerAmount(value.duration),
    pricing: adaptServicePrice(value, currency),
    deposit: deposit?.kind === "none" ? undefined : deposit,
    category: adaptCategory(value.category ?? value.serviceCategory),
    bookingEnabled: bookingEnabled && availability === "bookable",
    availability,
  };
}

function catalogIsPaginated(root: unknown): boolean {
  if (!isRecord(root)) {
    return false;
  }
  return (
    readNumber(root.page) !== undefined ||
    readNumber(root.pageSize) !== undefined ||
    readNumber(root.totalPages) !== undefined ||
    readBoolean(root.hasMore) === true
  );
}

export function adaptServiceCatalog(
  payload: unknown,
  currency?: string,
): ServiceCatalogView {
  const root = unwrapPayload(payload);
  const items = asList(root, ["services", "items", "results"])
    .map((item) => adaptServiceListItem(item, currency))
    .filter((item): item is ServiceListItemView => Boolean(item));

  const totalCount = isRecord(root) ? readNumber(root.total) ?? readNumber(root.totalCount) : undefined;

  return {
    items,
    paginated: catalogIsPaginated(root),
    totalCount: totalCount !== undefined && Number.isInteger(totalCount) ? totalCount : items.length,
  };
}

export function adaptServiceDetail(
  payload: unknown,
  currency?: string,
): ServiceDetailView | null {
  const root = unwrapPayload(payload);
  const source = isRecord(root)
    ? isRecord(root.service)
      ? root.service
      : root
    : null;
  if (!source) {
    return null;
  }

  const item = adaptServiceListItem(source, currency, { allowInactive: true });
  if (!item) {
    return null;
  }

  return {
    ...item,
    shortDescription: asSafeText(source.shortDescription) ?? asSafeText(source.summary) ?? item.shortDescription,
    description: asSafeText(source.description) ?? asSafeText(source.fullDescription) ?? asSafeText(source.body),
    preparation:
      asSafeText(source.preparation) ??
      asSafeText(source.preparationInfo) ??
      asSafeText(source.instructions),
    visitInfo: asSafeText(source.visitInfo) ?? asSafeText(source.processInfo),
    policy: asSafeText(source.policy) ?? asSafeText(source.cancellationPolicy),
    additionalFields: adaptAdditionalFields(root),
  };
}

export function relatedProvidersFromPayload(payload: unknown): PublicProvider[] {
  const root = unwrapPayload(payload);
  if (isRecord(root) && (root.providers !== undefined || root.relatedProviders !== undefined)) {
    return adaptPublicProviders(root.providers ?? root.relatedProviders);
  }
  return [];
}

export function relatedBranchesFromPayload(payload: unknown): PublicBranch[] {
  const root = unwrapPayload(payload);
  if (isRecord(root) && (root.branches !== undefined || root.relatedBranches !== undefined)) {
    return adaptPublicBranches(root.branches ?? root.relatedBranches);
  }
  return [];
}

export function toServiceListItem(service: PublicService): ServiceListItemView {
  return {
    id: service.id,
    name: service.name,
    shortDescription: service.shortDescription,
    imageUrl: service.imageUrl,
    durationMinutes: service.durationMinutes,
    pricing: service.priceLabel
      ? { kind: "fixed", label: service.priceLabel }
      : { kind: "hidden", label: "قیمت اعلام نشده" },
    bookingEnabled: true,
    availability: "bookable",
  };
}

export function serviceHref(service: Pick<ServiceListItemView, "id" | "slug">): string {
  return `/services/${service.slug ?? service.id}`;
}

export function isBookableService(service: Pick<ServiceListItemView, "bookingEnabled" | "availability">): boolean {
  return service.availability === "bookable" && service.bookingEnabled;
}
