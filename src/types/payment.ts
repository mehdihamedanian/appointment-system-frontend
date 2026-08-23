export type PaymentMethodType = "full" | "deposit" | "pay_at_location";

export type PaymentUiState =
  | "selecting-method"
  | "applying-coupon"
  | "creating-payment"
  | "redirecting"
  | "processing"
  | "verifying"
  | "success"
  | "failed"
  | "pending"
  | "expired"
  | "cancelled"
  | "unknown"
  | "error";

export type PaymentResultStatus =
  | "created"
  | "redirect_required"
  | "processing"
  | "pending"
  | "paid"
  | "deposit_paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "pay_at_location"
  | "unknown";

export type CouponStatus =
  | "applied"
  | "invalid"
  | "expired"
  | "not_applicable"
  | "limit_reached";

export type PaymentOptionView = {
  type: PaymentMethodType;
  title: string;
  description: string;
  payableNowLabel?: string;
  remainingAtLocationLabel?: string;
  remainingDueLabel?: string;
  refundability?: string;
};

export type CouponView = {
  code: string;
  status: CouponStatus;
  message?: string;
};

export type PaymentSessionView = {
  paymentId: string;
  publicReference?: string;
  status: PaymentResultStatus;
  redirectUrl?: string;
  expiresAt?: string;
  gatewayName?: string;
  payableNowLabel?: string;
  bookingReference?: string;
  transactionReference?: string;
  paidAt?: string;
  retryAllowed?: boolean;
  alreadyPaid?: boolean;
  alreadyProcessing?: boolean;
};

export const PAYMENT_METHOD_COPY: Record<PaymentMethodType, { title: string; description: string }> = {
  full: {
    title: "پرداخت کامل",
    description: "مبلغ قابل پرداخت اکنون از استعلام سرویس می‌آید و پس از پرداخت موفق، نوبت قطعی می‌شود.",
  },
  deposit: {
    title: "پرداخت بیعانه",
    description: "بیعانه اکنون پرداخت می‌شود. مانده طبق اعلام مجموعه هنگام مراجعه دریافت می‌شود.",
  },
  pay_at_location: {
    title: "پرداخت در محل",
    description: "نوبت ثبت می‌شود و مبلغ هنگام مراجعه پرداخت می‌گردد. این مسیر رایگان نیست.",
  },
};
