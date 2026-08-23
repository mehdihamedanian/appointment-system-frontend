import type { PaymentResultStatus, PaymentUiState } from "@/types/payment";

export function derivePaymentUiState(input: {
  applyingCoupon?: boolean;
  creating?: boolean;
  redirecting?: boolean;
  verifying?: boolean;
  resultStatus?: PaymentResultStatus;
  offline?: boolean;
  error?: boolean;
}): PaymentUiState {
  if (input.creating) return "creating-payment";
  if (input.redirecting) return "redirecting";
  if (input.verifying) return "verifying";
  if (input.applyingCoupon) return "applying-coupon";
  if (input.offline) return "unknown";
  if (input.resultStatus === "paid" || input.resultStatus === "deposit_paid") return "success";
  if (input.resultStatus === "pay_at_location") return "success";
  if (input.resultStatus === "failed") return "failed";
  if (input.resultStatus === "cancelled") return "cancelled";
  if (input.resultStatus === "expired") return "expired";
  if (input.resultStatus === "pending" || input.resultStatus === "processing") return "pending";
  if (input.resultStatus === "unknown") return "unknown";
  if (input.error) return "error";
  return "selecting-method";
}

export function paymentAttemptBlocked(state: PaymentUiState): boolean {
  return (
    state === "creating-payment" ||
    state === "redirecting" ||
    state === "processing" ||
    state === "verifying" ||
    state === "pending" ||
    state === "success"
  );
}

export function retryAllowedForState(state: PaymentUiState, backendRetryAllowed?: boolean): boolean {
  if (backendRetryAllowed === false) {
    return false;
  }
  return state === "failed" || state === "expired" || state === "cancelled";
}
