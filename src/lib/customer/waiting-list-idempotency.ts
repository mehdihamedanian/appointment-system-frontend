import type { WaitingListJoinInput } from "@/types/waiting-list";
import { createIdempotencyKey } from "@/lib/booking/idempotency";

export function waitingListJoinFingerprint(input: WaitingListJoinInput): string {
  const preference = input.providerPreference;
  const date =
    input.datePreference.mode === "specific"
      ? input.datePreference.date
      : input.datePreference.mode === "range"
        ? `${input.datePreference.from}:${input.datePreference.to}`
        : input.datePreference.mode === "multiple"
          ? input.datePreference.dates.join(",")
          : "any";
  return [
    input.serviceId,
    input.branchId ?? "",
    preference.type,
    preference.type === "specific" ? preference.providerId : "",
    date,
    input.timePreference,
    input.timeFrom ?? "",
    input.timeTo ?? "",
    input.note ?? "",
    input.contextDate ?? "",
  ].join(":");
}

export function waitingListIdempotencyKey(
  store: { current: { fingerprint: string; key: string } | null },
  fingerprint: string,
): string {
  if (store.current?.fingerprint === fingerprint) {
    return store.current.key;
  }
  const key = createIdempotencyKey();
  store.current = { fingerprint, key };
  return key;
}
