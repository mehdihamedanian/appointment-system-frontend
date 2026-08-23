import { isSafePublicId } from "@/lib/public/booking-href";
import { hasInternalResourceKeys } from "@/lib/booking/draft";
import type { BookingDraft } from "@/types/booking";

export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function quoteIntentFingerprint(draft: BookingDraft, quoteId?: string): string {
  const preference = draft.providerPreference;
  const extra = Object.entries(draft.additionalData)
    .filter(([key]) => isSafePublicId(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");
  return [
    draft.serviceId ?? "",
    draft.branchId ?? "",
    preference.type,
    preference.type === "specific" ? preference.providerId : "",
    draft.date ?? "",
    draft.slotId ?? "",
    quoteId ?? "",
    extra,
  ].join(":");
}

export function sanitizedAdditionalData(
  values: Record<string, string | boolean>,
): Record<string, string | boolean> | undefined {
  const next: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isSafePublicId(key)) {
      continue;
    }
    next[key] = value;
  }
  if (hasInternalResourceKeys(next as Record<string, unknown>)) {
    return undefined;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
