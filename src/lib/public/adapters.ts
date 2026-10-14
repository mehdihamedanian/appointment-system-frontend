import { env } from "@/config/env";
import { isRecord, readString } from "@/lib/utilities/records";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asList,
  readBoolean,
  readNumber,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import { parseWeekday, weekdayLabel } from "@/lib/public/working-hours";
import type {
  PublicBranch,
  PublicBusiness,
  PublicProvider,
  PublicService,
  PublicSocialLink,
  WorkingHoursDay,
  WorkingHoursRange,
} from "@/types/public";

const INTERNAL_RESOURCE_KINDS = [
  "room",
  "device",
  "bed",
  "chair",
  "desk",
  "equipment",
  "resource",
  "machine",
  "cabin",
  "booth",
  "allocation",
  "internal",
];

export function readId(value: unknown): string | undefined {
  const id =
    readString(isRecord(value) ? value.id : undefined) ??
    readString(isRecord(value) ? value.publicId : undefined) ??
    readString(isRecord(value) ? value.slug : undefined);
  return isSafePublicId(id) ? id : undefined;
}

export function isExplicitlyInactive(source: Record<string, unknown>): boolean {
  const status = readString(source.status)?.toLowerCase();
  if (status && ["inactive", "archived", "disabled", "hidden", "draft"].includes(status)) {
    return true;
  }
  if (readBoolean(source.active) === false) {
    return true;
  }
  if (readBoolean(source.isActive) === false) {
    return true;
  }
  if (readBoolean(source.archived) === true) {
    return true;
  }
  return false;
}

export function isExplicitlyPrivate(source: Record<string, unknown>): boolean {
  const visibility = readString(source.visibility)?.toLowerCase();
  if (visibility && ["private", "internal", "hidden"].includes(visibility)) {
    return true;
  }
  if (readBoolean(source.public) === false) {
    return true;
  }
  if (readBoolean(source.isPublic) === false) {
    return true;
  }
  return false;
}

function kindOf(source: Record<string, unknown>): string {
  return (
    readString(source.kind) ??
    readString(source.type) ??
    readString(source.resourceType) ??
    readString(source.category) ??
    ""
  ).toLowerCase();
}

export function isInternalResource(source: Record<string, unknown>): boolean {
  const kind = kindOf(source);
  return INTERNAL_RESOURCE_KINDS.some((item) => kind.includes(item));
}

function parseRange(value: unknown): WorkingHoursRange | null {
  if (typeof value === "string") {
    const [start, end] = value.split(/-|–|تا/).map((part) => part.trim());
    if (start && end) {
      return { start, end };
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const start = readString(value.start) ?? readString(value.from) ?? readString(value.open);
  const end = readString(value.end) ?? readString(value.to) ?? readString(value.close);
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

export function adaptWorkingHours(value: unknown): WorkingHoursDay[] {
  const items = asList(value, ["days", "weekly", "hours", "schedule"]);
  const days: WorkingHoursDay[] = [];

  if (isRecord(value) && items.length === 0) {
    for (const [key, ranges] of Object.entries(value)) {
      const weekday = parseWeekday(key);
      if (weekday === undefined) {
        continue;
      }
      const closed =
        ranges === "closed" ||
        ranges === false ||
        (isRecord(ranges) && readBoolean(ranges.closed) === true);
      const parsedRanges = closed
        ? []
        : ([parseRange(ranges), ...asList(ranges, ["ranges", "hours"]).map(parseRange)].filter(
            (range): range is WorkingHoursRange => Boolean(range),
          ));
      days.push({
        id: String(weekday),
        weekday,
        label: weekdayLabel(weekday),
        closed: Boolean(closed),
        special: false,
        holiday: false,
        ranges: parsedRanges,
      });
    }
    return days;
  }

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const weekday =
      parseWeekday(item.weekday) ??
      parseWeekday(item.day) ??
      parseWeekday(item.dayOfWeek) ??
      parseWeekday(item.name);
    if (weekday === undefined) {
      continue;
    }
    const closed = readBoolean(item.closed) === true || readBoolean(item.isClosed) === true;
    const ranges = asList(item.ranges ?? item.hours ?? item.slots, [])
      .map(parseRange)
      .filter((range): range is WorkingHoursRange => Boolean(range));
    if (!closed && ranges.length === 0) {
      const single = parseRange(item);
      if (single) {
        ranges.push(single);
      }
    }
    days.push({
      id: readString(item.id) ?? String(weekday),
      weekday,
      label: readString(item.label) ?? weekdayLabel(weekday),
      closed,
      special: readBoolean(item.special) === true,
      holiday: readBoolean(item.holiday) === true,
      ranges: closed ? [] : ranges,
    });
  }

  return days;
}

function adaptSocialLinks(value: unknown): PublicSocialLink[] {
  return asList(value, ["social", "socialLinks", "links"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const href = readUrl(item.href ?? item.url);
      const label = readString(item.label) ?? readString(item.name) ?? readString(item.network);
      if (!href || !label) {
        return null;
      }
      return { href, label };
    })
    .filter((item): item is PublicSocialLink => Boolean(item));
}

function formatPrice(source: Record<string, unknown>, currency?: string): string | undefined {
  const labeled =
    readString(source.priceLabel) ??
    readString(source.priceDisplay) ??
    readString(source.formattedPrice) ??
    readString(source.startingPriceLabel);
  if (labeled) {
    return labeled;
  }
  const amount = readNumber(source.price) ?? readNumber(source.amount);
  if (amount === undefined) {
    return undefined;
  }
  const code = readString(source.currency) ?? currency;
  try {
    return new Intl.NumberFormat("fa-IR", {
      style: code ? "currency" : "decimal",
      currency: code || "IRR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

export function configuredPublicBusiness(): PublicBusiness {
  return {
    name: env.appName,
    tagline: env.appTagline || undefined,
    socialLinks: [],
    bookingEnabled: true,
    providerPresentationEnabled: false,
    branchesEnabled: false,
    workingHours: [],
    contactHours: [],
  };
}

export function adaptPublicBusiness(payload: unknown): PublicBusiness | null {
  const root = unwrapPayload(payload);
  const source = isRecord(root)
    ? (isRecord(root.business) ? root.business : root)
    : null;
  if (!source) {
    return null;
  }

  const name =
    readString(source.name) ??
    readString(source.displayName) ??
    readString(source.title) ??
    env.appName;
  if (!name) {
    return null;
  }

  const bookingEnabled = readBoolean(source.bookingEnabled) ?? readBoolean(source.onlineBooking) ?? true;
  const providerPresentationEnabled =
    readBoolean(source.providerSelectionEnabled) ??
    readBoolean(source.selectableProviders) ??
    readBoolean(source.showProviders) ??
    false;
  const branchesEnabled =
    readBoolean(source.branchesEnabled) ??
    readBoolean(source.multipleBranches) ??
    false;
  const couponsEnabled =
    readBoolean(source.couponsEnabled) ??
    readBoolean(source.discountCouponsEnabled) ??
    readBoolean(isRecord(source.capabilities) ? source.capabilities.coupons : undefined);
  const waitingListEnabled =
    readBoolean(source.waitingListEnabled) ??
    readBoolean(isRecord(source.capabilities) ? source.capabilities.waitingList : undefined);

  return {
    name,
    tagline: readString(source.tagline) ?? readString(source.slogan) ?? env.appTagline,
    shortDescription:
      readString(source.shortDescription) ??
      readString(source.summary) ??
      readString(source.description),
    about: readString(source.about) ?? readString(source.introduction),
    fieldOfActivity: readString(source.fieldOfActivity) ?? readString(source.activityField),
    visitInfo: readString(source.visitInfo) ?? readString(source.processInfo),
    logoUrl: readUrl(source.logoUrl ?? source.logo),
    heroImageUrl: readUrl(source.heroImageUrl ?? source.heroImage ?? source.coverImage),
    phone: readString(source.phone) ?? readString(source.mobile) ?? readString(source.tel),
    email: readString(source.email),
    address: readString(source.address) ?? readString(source.locationAddress),
    directionsUrl: readUrl(source.directionsUrl ?? source.mapsUrl ?? source.locationUrl),
    timezone: readString(source.timezone) ?? readString(source.timeZone),
    currency: readString(source.currency),
    socialLinks: adaptSocialLinks(source.socialLinks ?? source.social),
    bookingEnabled,
    providerPresentationEnabled,
    branchesEnabled,
    ...(couponsEnabled !== undefined ? { couponsEnabled } : {}),
    ...(waitingListEnabled !== undefined ? { waitingListEnabled } : {}),
    workingHours: adaptWorkingHours(
      source.workingHours ?? source.hours ?? source.businessHours,
    ),
    contactHours: adaptWorkingHours(source.contactHours),
  };
}

export function adaptPublicServices(payload: unknown, currency?: string): PublicService[] {
  const items = asList(unwrapPayload(payload), ["services", "items", "results"]);
  const adapted: Array<PublicService & { featured: boolean }> = [];

  for (const item of items) {
    if (!isRecord(item) || isExplicitlyInactive(item)) {
      continue;
    }
    const id = readId(item);
    const name = readString(item.name) ?? readString(item.title);
    if (!id || !name) {
      continue;
    }
    adapted.push({
      id,
      name,
      shortDescription:
        readString(item.shortDescription) ??
        readString(item.summary) ??
        readString(item.description),
      imageUrl: readUrl(item.imageUrl ?? item.image ?? item.coverImage),
      durationMinutes:
        readNumber(item.durationMinutes) ??
        readNumber(item.duration_minutes) ??
        readNumber(item.duration),
      priceLabel: formatPrice(item, currency),
      featured: readBoolean(item.featured) ?? readBoolean(item.isFeatured) ?? false,
    });
  }

  const featured = adapted.filter((service) => service.featured);
  const picked = featured.length > 0 ? featured : adapted;
  return picked.slice(0, 8).map((service) => ({
    id: service.id,
    name: service.name,
    shortDescription: service.shortDescription,
    imageUrl: service.imageUrl,
    durationMinutes: service.durationMinutes,
    priceLabel: service.priceLabel,
  }));
}

export function adaptPublicProviders(payload: unknown): PublicProvider[] {
  const items = asList(unwrapPayload(payload), ["providers", "staff", "items", "results"]);
  const providers: PublicProvider[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    if (isExplicitlyInactive(item) || isExplicitlyPrivate(item) || isInternalResource(item)) {
      continue;
    }
    const id = readId(item);
    const name = readString(item.name) ?? readString(item.displayName) ?? readString(item.fullName);
    if (!id || !name) {
      continue;
    }
    providers.push({
      id,
      name,
      title:
        readString(item.title) ??
        readString(item.specialty) ??
        readString(item.publicTitle) ??
        readString(item.role),
      imageUrl: readUrl(item.imageUrl ?? item.photoUrl ?? item.avatarUrl),
      relatedServiceNames: asList(item.services ?? item.relatedServices, [])
        .map((service) =>
          typeof service === "string"
            ? service
            : readString(isRecord(service) ? service.name : undefined),
        )
        .filter((value): value is string => Boolean(value)),
      availabilitySummary: readString(item.availabilitySummary) ?? readString(item.publicAvailability),
    });
  }

  return providers;
}

export function adaptPublicBranches(payload: unknown): PublicBranch[] {
  const items = asList(unwrapPayload(payload), ["branches", "locations", "items", "results"]);
  const branches: PublicBranch[] = [];

  for (const item of items) {
    if (!isRecord(item) || isExplicitlyInactive(item) || isExplicitlyPrivate(item)) {
      continue;
    }
    const id = readId(item);
    const name = readString(item.name) ?? readString(item.title);
    if (!id || !name) {
      continue;
    }
    branches.push({
      id,
      name,
      address: readString(item.address),
      phone: readString(item.phone),
      workingHours: adaptWorkingHours(item.workingHours ?? item.hours),
    });
  }

  return branches;
}

export function hasAboutContent(business: PublicBusiness): boolean {
  return Boolean(
    business.about ||
      business.fieldOfActivity ||
      business.visitInfo ||
      (business.shortDescription && business.shortDescription !== business.tagline),
  );
}
