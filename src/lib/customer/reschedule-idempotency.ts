import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type { MutableRefObject } from "react";

export function rescheduleIntentFingerprint(
  reference: string,
  slotId: string,
  previewVersion?: string,
): string {
  return `${reference}:${slotId}:${previewVersion ?? "v0"}`;
}

export function rescheduleIdempotencyKey(
  store: MutableRefObject<{ fingerprint: string; key: string } | undefined>,
  fingerprint: string,
): string {
  if (store.current?.fingerprint !== fingerprint) {
    store.current = { fingerprint, key: createIdempotencyKey() };
  }
  return store.current.key;
}
