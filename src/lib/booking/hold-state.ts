import { HOLD_CRITICAL_MS, HOLD_WARNING_MS, type HoldUiState, type SlotHoldView } from "@/types/hold";

export type HoldUrgency = "active" | "warning" | "critical" | "elapsed";

export function holdUrgency(remainingMs: number | null): HoldUrgency {
  if (remainingMs === null) {
    return "elapsed";
  }
  if (remainingMs <= 0) {
    return "elapsed";
  }
  if (remainingMs <= HOLD_CRITICAL_MS) {
    return "critical";
  }
  if (remainingMs <= HOLD_WARNING_MS) {
    return "warning";
  }
  return "active";
}

export function deriveHoldUiState(input: {
  hold?: SlotHoldView;
  loading?: boolean;
  creating?: boolean;
  remainingMs: number | null;
  paymentInFlight?: boolean;
  checkingStatus?: boolean;
  offline?: boolean;
  error?: boolean;
}): HoldUiState {
  if (input.creating) return "creating-hold";
  if (input.loading && !input.hold) return "loading-existing-hold";
  if (input.offline) return "offline";
  if (input.error && !input.hold) return "error";
  if (input.checkingStatus) return "checking-status";
  if (input.hold?.status === "consumed") return "consumed";
  if (input.hold?.status === "released") return "released";
  if (input.hold?.status === "invalid") return "invalid";
  if (input.hold?.status === "expired" && input.paymentInFlight) return "checking-status";
  if (input.hold?.status === "expired") return "expired";
  if (input.paymentInFlight) {
    return input.hold?.paymentContextId ? "payment-processing" : "starting-payment";
  }
  if (input.hold?.status === "active") {
    if (input.remainingMs === null) return "error";
    const urgency = holdUrgency(input.remainingMs);
    if (urgency === "elapsed") return "checking-status";
    return urgency;
  }
  return "error";
}

export function paymentAllowed(state: HoldUiState): boolean {
  return state === "active" || state === "warning" || state === "critical";
}

export function shouldDeferExpiryNavigation(state: HoldUiState): boolean {
  return (
    state === "starting-payment" ||
    state === "payment-processing" ||
    state === "checking-status" ||
    state === "consumed"
  );
}

export function holdAnnouncement(state: HoldUiState): string | undefined {
  if (state === "warning") {
    return "کمتر از دو دقیقه تا پایان رزرو موقت باقی مانده است.";
  }
  if (state === "critical") {
    return "کمتر از سی ثانیه تا پایان رزرو موقت باقی مانده است.";
  }
  if (state === "expired") {
    return "مهلت نگه‌داشتن این زمان به پایان رسید.";
  }
  if (state === "consumed") {
    return "رزرو موقت استفاده شد.";
  }
  if (state === "starting-payment" || state === "payment-processing") {
    return "در حال آماده‌سازی پرداخت.";
  }
  return undefined;
}
