import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type { AdminAppointmentActionKey } from "@/types/admin-appointment";

type IdempotencyStore = { current?: { fingerprint: string; key: string } };

export function adminActionFingerprint(input: {
  reference: string;
  action: AdminAppointmentActionKey;
  version?: string;
}): string {
  return [input.reference, input.action, input.version ?? ""].join("|");
}

export function adminActionIdempotencyKey(store: IdempotencyStore, fingerprint: string): string {
  if (store.current?.fingerprint !== fingerprint) {
    store.current = { fingerprint, key: createIdempotencyKey() };
  }
  return store.current.key;
}

export function internalNoteFingerprint(input: {
  reference: string;
  note: string;
  version?: string;
}): string {
  return [input.reference, input.note.trim(), input.version ?? ""].join("|");
}

export function internalNoteIdempotencyKey(store: IdempotencyStore, fingerprint: string): string {
  if (store.current?.fingerprint !== fingerprint) {
    store.current = { fingerprint, key: createIdempotencyKey() };
  }
  return store.current.key;
}
