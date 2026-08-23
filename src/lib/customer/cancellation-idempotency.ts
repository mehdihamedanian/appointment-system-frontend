import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type { MutableRefObject } from "react";

export function cancellationIntentFingerprint(reference: string, previewVersion?: string): string {
  return `${reference}:${previewVersion ?? "v0"}`;
}

export function cancellationIdempotencyKey(
  store: MutableRefObject<{ fingerprint: string; key: string } | undefined>,
  fingerprint: string,
): string {
  if (store.current?.fingerprint !== fingerprint) {
    store.current = { fingerprint, key: createIdempotencyKey() };
  }
  return store.current.key;
}
