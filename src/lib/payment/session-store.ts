import { isSafePublicId } from "@/lib/public/booking-href";

export const PAYMENT_SESSION_KEY = "appointment.booking.payment.v1";
export const PAYMENT_BROADCAST_CHANNEL = "appointment.booking.payment";

export type PersistedPaymentRef = {
  version: 1;
  paymentReference: string;
  holdReference?: string;
};

export function writePaymentReference(input: { paymentReference: string; holdReference?: string }): void {
  if (typeof window === "undefined" || !isSafePublicId(input.paymentReference)) {
    return;
  }
  const payload: PersistedPaymentRef = {
    version: 1,
    paymentReference: input.paymentReference,
  };
  if (input.holdReference && isSafePublicId(input.holdReference)) {
    payload.holdReference = input.holdReference;
  }
  window.sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(payload));
}

export function readPaymentReference(): PersistedPaymentRef | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.sessionStorage.getItem(PAYMENT_SESSION_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as PersistedPaymentRef;
    if (value.version !== 1 || !isSafePublicId(value.paymentReference)) {
      clearPaymentReference();
      return undefined;
    }
    return value;
  } catch {
    clearPaymentReference();
    return undefined;
  }
}

export function clearPaymentReference(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(PAYMENT_SESSION_KEY);
}

export function publishPaymentStatus(reference: string, status: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  if (!isSafePublicId(reference)) {
    return;
  }
  const channel = new BroadcastChannel(PAYMENT_BROADCAST_CHANNEL);
  channel.postMessage({ reference, status });
  channel.close();
}
