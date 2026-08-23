import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type { MutableRefObject } from "react";

export function reviewIntentFingerprint(
  reference: string,
  rating: number,
  comment: string,
): string {
  return `${reference}:${rating}:${comment}`;
}

export function reviewIdempotencyKey(
  store: MutableRefObject<{ fingerprint: string; key: string } | null>,
  fingerprint: string,
): string {
  if (store.current?.fingerprint !== fingerprint) {
    store.current = { fingerprint, key: createIdempotencyKey() };
  }
  return store.current.key;
}
