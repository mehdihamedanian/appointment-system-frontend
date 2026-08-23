export type SlotHoldStatus = "active" | "expired" | "consumed" | "released" | "invalid";

export type HoldUiState =
  | "creating-hold"
  | "loading-existing-hold"
  | "active"
  | "warning"
  | "critical"
  | "starting-payment"
  | "payment-processing"
  | "checking-status"
  | "consumed"
  | "expired"
  | "released"
  | "invalid"
  | "offline"
  | "error";

export type SlotHoldView = {
  holdId: string;
  publicReference?: string;
  status: SlotHoldStatus;
  expiresAt?: string;
  serverNow?: string;
  slot: {
    id: string;
    startsAt?: string;
  };
  paymentContextId?: string;
  payableNowLabel?: string;
  serviceName?: string;
  providerLabel?: string;
  branchName?: string;
  timezone?: string;
  bookingReference?: string;
  paymentStatus?: string;
};

export const HOLD_WARNING_MS = 120_000;
export const HOLD_CRITICAL_MS = 30_000;
export const HOLD_REVALIDATE_NEAR_MS = 5_000;
