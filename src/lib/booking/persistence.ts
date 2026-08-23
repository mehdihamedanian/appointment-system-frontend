import { isSafePublicId } from "@/lib/public/booking-href";
import { persistableDraft } from "@/lib/booking/draft";
import { isBookingStepId } from "@/lib/booking/steps";
import type { BookingDraft, BookingStepId } from "@/types/booking";
import { emptyBookingDraft } from "@/types/booking";
import type { ProviderPreference } from "@/types/provider";

export const BOOKING_DRAFT_STORAGE_KEY = "appointment.booking.draft.v1";
export const BOOKING_DRAFT_COMPLETED_KEY = "appointment.booking.draft.completed.v1";
export const BOOKING_DRAFT_VERSION = 1;
export const BOOKING_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export type PersistedBookingDraft = {
  version: number;
  expiresAt: string;
  currentStep?: BookingStepId;
  serviceId: string | null;
  branchId: string | null;
  providerPreference: ProviderPreference;
  date: string | null;
  slotId: string | null;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function isPreference(value: unknown): value is ProviderPreference {
  if (!value || typeof value !== "object") {
    return false;
  }
  const type = (value as ProviderPreference).type;
  if (type === "any" || type === "automatic" || type === "not_applicable") {
    return true;
  }
  return (
    type === "specific" &&
    isSafePublicId((value as { providerId?: string }).providerId)
  );
}

export function serializeBookingDraft(
  draft: BookingDraft,
  currentStep: BookingStepId,
  now = Date.now(),
): PersistedBookingDraft {
  const safe = persistableDraft(draft);
  return {
    version: BOOKING_DRAFT_VERSION,
    expiresAt: new Date(now + BOOKING_DRAFT_TTL_MS).toISOString(),
    currentStep,
    ...safe,
  };
}

export function parsePersistedBookingDraft(
  raw: string | null,
  now = Date.now(),
): PersistedBookingDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as PersistedBookingDraft;
    if (value.version !== BOOKING_DRAFT_VERSION) {
      return null;
    }
    const expires = Date.parse(value.expiresAt);
    if (!Number.isFinite(expires) || expires <= now) {
      return null;
    }
    if (value.serviceId && !isSafePublicId(value.serviceId)) {
      return null;
    }
    if (value.branchId && !isSafePublicId(value.branchId)) {
      return null;
    }
    if (value.slotId && !isSafePublicId(value.slotId)) {
      return null;
    }
    if (value.date && !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
      return null;
    }
    if (!isPreference(value.providerPreference)) {
      return null;
    }
    if (value.currentStep && !isBookingStepId(value.currentStep)) {
      return null;
    }
    if (
      "additionalData" in value ||
      "otp" in value ||
      "token" in value ||
      "holdId" in value ||
      "quoteId" in value ||
      "price" in value
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function readBookingDraft(): PersistedBookingDraft | null {
  if (!canUseStorage()) {
    return null;
  }
  const parsed = parsePersistedBookingDraft(window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY));
  if (!parsed) {
    clearBookingDraft();
  }
  return parsed;
}

export function writeBookingDraft(draft: BookingDraft, currentStep: BookingStepId): void {
  if (!canUseStorage()) {
    return;
  }
  window.sessionStorage.setItem(
    BOOKING_DRAFT_STORAGE_KEY,
    JSON.stringify(serializeBookingDraft(draft, currentStep)),
  );
}

export function clearBookingDraft(): void {
  if (!canUseStorage()) {
    return;
  }
  window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
}

export function markBookingDraftCompleted(reference?: string): void {
  if (!canUseStorage()) {
    return;
  }
  clearBookingDraft();
  const payload = {
    version: BOOKING_DRAFT_VERSION,
    completedAt: new Date().toISOString(),
    reference: reference && isSafePublicId(reference) ? reference : undefined,
  };
  window.sessionStorage.setItem(BOOKING_DRAFT_COMPLETED_KEY, JSON.stringify(payload));
}

export function isBookingDraftCompleted(): boolean {
  if (!canUseStorage()) {
    return false;
  }
  const raw = window.sessionStorage.getItem(BOOKING_DRAFT_COMPLETED_KEY);
  if (!raw) {
    return false;
  }
  try {
    const value = JSON.parse(raw) as { version?: number };
    return value.version === BOOKING_DRAFT_VERSION;
  } catch {
    return false;
  }
}

export function draftFromPersisted(persisted: PersistedBookingDraft): BookingDraft {
  const draft = emptyBookingDraft();
  draft.serviceId = persisted.serviceId;
  draft.branchId = persisted.branchId;
  draft.providerPreference = persisted.providerPreference;
  draft.date = persisted.date;
  draft.slotId = persisted.slotId;
  return draft;
}
