import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, asSafeText, readBoolean, readNumber, unwrapPayload } from "@/lib/public/read";
import { isTimestampExpired } from "@/lib/date-time/format";
import { getSafeCustomerDeepLink } from "@/lib/customer/deep-link";
import { parseStatusKey } from "@/lib/status/status-map";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  AppointmentActionsView,
  AppointmentBranchSnapshot,
  AppointmentCategory,
  AppointmentListItemView,
  AppointmentListView,
  AppointmentProviderSnapshot,
  AppointmentServiceSnapshot,
} from "@/types/appointment-list";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

function adaptService(root: Record<string, unknown>): AppointmentServiceSnapshot | undefined {
  const source = isRecord(root.service) && !isInternalResource(root.service) ? root.service : undefined;
  const name =
    asSafeText(source?.name) ??
    asSafeText(source?.title) ??
    asSafeText(root.serviceName);
  if (!name) {
    return undefined;
  }
  const snapshot: AppointmentServiceSnapshot = { name };
  const id = publicId(source?.id) ?? publicId(root.serviceId);
  if (id) snapshot.id = id;
  return snapshot;
}

function adaptProvider(root: Record<string, unknown>): AppointmentProviderSnapshot | undefined {
  const source = isRecord(root.provider) && !isInternalResource(root.provider) ? root.provider : undefined;
  const modeRaw = (
    readString(source?.mode) ??
    readString(source?.assignment) ??
    readString(root.providerAssignment) ??
    readString(root.providerMode)
  )?.toLowerCase().replace(/[\s-]+/g, "_");
  if (modeRaw === "not_applicable" || modeRaw === "none" || modeRaw === "omitted") {
    return { mode: "not_applicable" };
  }
  const name =
    asSafeText(source?.name) ??
    asSafeText(source?.displayName) ??
    asSafeText(source?.publicName) ??
    asSafeText(root.providerName);
  const title = asSafeText(source?.title) ?? asSafeText(source?.publicTitle);
  const id = publicId(source?.id) ?? publicId(root.providerId);
  if (modeRaw === "automatic" || modeRaw === "pending_assignment" || modeRaw === "pending") {
    const view: AppointmentProviderSnapshot = { mode: "pending_assignment" };
    if (name) view.name = name;
    if (title) view.title = title;
    if (id) view.id = id;
    return view;
  }
  if (name) {
    const view: AppointmentProviderSnapshot = {
      mode: modeRaw === "assigned" || modeRaw === "automatic_assigned" ? "assigned" : "specific",
      name,
    };
    if (title) view.title = title;
    if (id && view.mode === "specific") view.id = id;
    return view;
  }
  if (modeRaw === "any" || modeRaw === "assigned" || modeRaw === "specific") {
    return { mode: "pending_assignment" };
  }
  return undefined;
}

function adaptBranch(root: Record<string, unknown>): AppointmentBranchSnapshot | undefined {
  const source = isRecord(root.branch) && !isInternalResource(root.branch) ? root.branch : undefined;
  const name = asSafeText(source?.name) ?? asSafeText(root.branchName);
  if (!name) {
    return undefined;
  }
  const snapshot: AppointmentBranchSnapshot = { name };
  const id = publicId(source?.id) ?? publicId(root.branchId);
  if (id) snapshot.id = id;
  return snapshot;
}

function readActionFlag(source: Record<string, unknown> | undefined, key: string): boolean {
  if (!source) {
    return false;
  }
  return readBoolean(source[key]) === true;
}

export function adaptActions(root: Record<string, unknown>, now: Date): AppointmentActionsView {
  const nested = isRecord(root.actions) ? root.actions : undefined;
  const source: Record<string, unknown> = nested ?? root;
  const hasActions = Boolean(nested);
  const explicit = hasActions || readBoolean(root.canPay) !== undefined || readBoolean(root.canCancel) !== undefined;
  const payValidUntil = readString(source.payValidUntil) ?? readString(source.validUntil);
  const expired = isTimestampExpired(payValidUntil, now);
  const payHrefRaw =
    readString(source.payHref) ??
    readString(source.paymentHref) ??
    readString(source.continueHref);
  const payHref = expired ? undefined : getSafeCustomerDeepLink(payHrefRaw);
  const canPay = readActionFlag(source, "canPay") && !expired;
  const actions: AppointmentActionsView = {
    canView: explicit ? readBoolean(source.canView) === true : true,
    canCancel: readActionFlag(source, "canCancel"),
    canReschedule: readActionFlag(source, "canReschedule"),
    canRepeat: readActionFlag(source, "canRepeat"),
    canPay,
    canReview: readActionFlag(source, "canReview"),
  };
  if (readBoolean(source.processing) === true || readBoolean(source.busy) === true) {
    actions.processing = true;
  }
  if (canPay) {
    actions.payHref = payHref ?? "/booking/payment";
  }
  if (payValidUntil && canPay) actions.payValidUntil = payValidUntil;
  const blocked = asSafeText(source.blockedReason) ?? asSafeText(source.actionReason);
  if (blocked) actions.blockedReason = blocked;
  return actions;
}

export function appointmentProviderLabel(provider?: AppointmentProviderSnapshot): string | undefined {
  if (!provider || provider.mode === "not_applicable") {
    return undefined;
  }
  if (provider.name) {
    return provider.title ? `${provider.name} — ${provider.title}` : provider.name;
  }
  if (provider.mode === "pending_assignment" || provider.mode === "assigned") {
    return "متخصص توسط مجموعه تعیین می‌شود";
  }
  return undefined;
}

export function adaptAppointmentListItem(value: unknown, now = new Date()): AppointmentListItemView | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id =
    publicId(value.publicReference) ??
    publicId(value.reference) ??
    publicId(value.bookingReference) ??
    publicId(value.id) ??
    publicId(value.appointmentId);
  const service = adaptService(value);
  const startsAt =
    readString(value.startsAt) ??
    readString(value.startAt) ??
    readString(value.scheduledAt);
  const status = parseStatusKey(value.status) ?? parseStatusKey(value.appointmentStatus);
  if (!id || !service || !startsAt || !status) {
    return null;
  }
  const item: AppointmentListItemView = {
    id,
    publicReference: publicId(value.publicReference) ?? publicId(value.reference) ?? publicId(value.bookingReference) ?? id,
    status,
    service,
    startsAt,
    actions: adaptActions(value, now),
  };
  const provider = adaptProvider(value);
  if (provider) item.provider = provider;
  const branch = adaptBranch(value);
  if (branch) item.branch = branch;
  const endsAt = readString(value.endsAt) ?? readString(value.endAt);
  if (endsAt) item.endsAt = endsAt;
  const duration = readNumber(value.durationMinutes) ?? readNumber(value.duration);
  if (typeof duration === "number" && Number.isInteger(duration) && duration > 0) {
    item.durationMinutes = duration;
  }
  const timezone = readString(value.timezone) ?? readString(value.timeZone);
  if (timezone) item.timezone = timezone;
  const paymentStatus =
    parseStatusKey(value.paymentStatus) ??
    parseStatusKey(isRecord(value.payment) ? value.payment.status : undefined);
  if (paymentStatus) item.paymentStatus = paymentStatus;
  return item;
}

function adaptCounts(value: unknown): AppointmentListView["counts"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const counts: NonNullable<AppointmentListView["counts"]> = {};
  const upcoming = readNumber(value.upcoming);
  const past = readNumber(value.past);
  const cancelled = readNumber(value.cancelled) ?? readNumber(value.canceled);
  if (typeof upcoming === "number" && Number.isInteger(upcoming) && upcoming >= 0) counts.upcoming = upcoming;
  if (typeof past === "number" && Number.isInteger(past) && past >= 0) counts.past = past;
  if (typeof cancelled === "number" && Number.isInteger(cancelled) && cancelled >= 0) {
    counts.cancelled = cancelled;
  }
  return Object.keys(counts).length > 0 ? counts : undefined;
}

export function adaptAppointmentList(
  payload: unknown,
  requestedCategory: AppointmentCategory,
  requestedPage = 1,
): AppointmentListView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(root, ["items", "appointments", "results"])
    .map((item) => adaptAppointmentListItem(item))
    .filter((item): item is AppointmentListItemView => Boolean(item));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  const page = readNumber(source.page) ?? requestedPage;
  const pageCount = readNumber(source.pageCount) ?? readNumber(source.totalPages);
  const nextCursor = publicId(source.nextCursor) ?? publicId(source.cursor);
  const hasMore =
    readBoolean(source.hasMore) === true ||
    Boolean(nextCursor) ||
    (typeof pageCount === "number" && Number.isInteger(pageCount) && page < pageCount);
  const view: AppointmentListView = {
    category: requestedCategory,
    items: unique,
    page: typeof page === "number" && page > 0 ? page : requestedPage,
    hasMore,
  };
  if (typeof pageCount === "number" && Number.isInteger(pageCount) && pageCount > 0) {
    view.pageCount = pageCount;
  }
  if (nextCursor) view.nextCursor = nextCursor;
  const counts = adaptCounts(source.counts ?? source.totals);
  if (counts) view.counts = counts;
  return view;
}
