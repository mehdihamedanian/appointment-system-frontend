import { createIdempotencyKey } from "@/lib/booking/idempotency";

export function paymentIntentFingerprint(input: {
  holdReference?: string;
  quoteId?: string;
  method: string;
  couponCode?: string;
}): string {
  return [
    input.holdReference ?? "",
    input.quoteId ?? "",
    input.method,
    input.couponCode?.trim().toUpperCase() ?? "",
  ].join(":");
}

export function paymentIdempotencyKey(
  store: { current?: { fingerprint: string; key: string } },
  fingerprint: string,
): string {
  if (store.current?.fingerprint === fingerprint) {
    return store.current.key;
  }
  const key = createIdempotencyKey();
  store.current = { fingerprint, key };
  return key;
}
