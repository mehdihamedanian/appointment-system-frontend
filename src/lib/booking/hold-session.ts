import { isSafePublicId } from "@/lib/public/booking-href";
import type { BookingNotice } from "@/types/booking";

export const HOLD_SESSION_KEY = "appointment.booking.hold.v1";
export const HOLD_RETURN_NOTICE_KEY = "appointment.booking.hold.notice.v1";
export const HOLD_BROADCAST_CHANNEL = "appointment.booking.hold";

type PersistedHoldRef = {
  version: 1;
  publicReference: string;
};

export function writeHoldReference(publicReference: string): void {
  if (typeof window === "undefined" || !isSafePublicId(publicReference)) {
    return;
  }
  window.sessionStorage.setItem(
    HOLD_SESSION_KEY,
    JSON.stringify({ version: 1, publicReference } satisfies PersistedHoldRef),
  );
}

export function readHoldReference(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.sessionStorage.getItem(HOLD_SESSION_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as PersistedHoldRef;
    if (value.version !== 1 || !isSafePublicId(value.publicReference)) {
      clearHoldReference();
      return undefined;
    }
    return value.publicReference;
  } catch {
    clearHoldReference();
    return undefined;
  }
}

export function clearHoldReference(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(HOLD_SESSION_KEY);
}

export function writeHoldReturnNotice(notice: BookingNotice): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(
    HOLD_RETURN_NOTICE_KEY,
    JSON.stringify({ version: 1, notice }),
  );
}

export function consumeHoldReturnNotice(): BookingNotice | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.sessionStorage.getItem(HOLD_RETURN_NOTICE_KEY);
  window.sessionStorage.removeItem(HOLD_RETURN_NOTICE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as { version?: number; notice?: BookingNotice };
    if (value.version !== 1) {
      return undefined;
    }
    return value.notice;
  } catch {
    return undefined;
  }
}

export type HoldBroadcastMessage = {
  reference: string;
  status: string;
};

export function publishHoldStatus(message: HoldBroadcastMessage): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  if (!isSafePublicId(message.reference)) {
    return;
  }
  const channel = new BroadcastChannel(HOLD_BROADCAST_CHANNEL);
  channel.postMessage(message);
  channel.close();
}
