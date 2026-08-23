import type {
  AvailabilityContext,
  AvailableSlotView,
  BookableDateDay,
} from "@/types/availability";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";
import type { CouponView, PaymentOptionView } from "@/types/payment";

export type BookingStepId =
  | "service"
  | "branch"
  | "provider"
  | "date"
  | "time"
  | "details"
  | "summary"
  | "checkout";

export type WizardStatus =
  | "initializing"
  | "ready"
  | "validating-step"
  | "loading-dependency"
  | "submitting"
  | "redirecting"
  | "success"
  | "expired"
  | "error";

export type BookingDraft = {
  serviceId: string | null;
  branchId: string | null;
  providerPreference: ProviderPreference;
  date: string | null;
  slotId: string | null;
  additionalData: Record<string, string | boolean>;
  quoteId?: string;
  holdId?: string;
};

export type BookingNotice =
  | "service_changed"
  | "branch_changed"
  | "provider_changed"
  | "service_unavailable"
  | "branch_unavailable"
  | "provider_unavailable"
  | "slot_taken"
  | "quote_changed"
  | "quote_expired"
  | "policy_changed"
  | "confirm_uncertain"
  | "hold_expired"
  | "hold_invalid"
  | "hold_released"
  | "no_availability"
  | "session_expired"
  | "restored"
  | "invalid_url_service";

export type AdditionalFieldType =
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "date";

export type AdditionalFieldOption = {
  value: string;
  label: string;
};

export type AdditionalFieldDefinition = {
  id: string;
  label: string;
  type: AdditionalFieldType;
  required: boolean;
  options: AdditionalFieldOption[];
  helpText?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  sensitive: boolean;
};

export type BookableDatesView = {
  available: boolean;
  dates: string[];
  days: BookableDateDay[];
  timezone?: string;
  month?: string;
  minDate?: string;
  maxDate?: string;
  serverNow?: string;
  unavailableReason?: "missing_endpoint" | "error" | "empty";
};

export type BookableSlotView = AvailableSlotView;

export type BookableSlotsView = {
  available: boolean;
  slots: AvailableSlotView[];
  timezone?: string;
  unavailableReason?: "missing_endpoint" | "error" | "empty" | "taken";
  /** Explicit Backend flag — never inferred from empty slots alone. */
  waitingListJoinAllowed?: boolean;
};

export type { AvailabilityContext, AvailableSlotView, BookableDateDay };

export type CheckoutPath =
  | "confirm"
  | "pay_full"
  | "pay_deposit"
  | "pay_at_location"
  | "unknown";

export type QuotePaymentMode = "none" | "full" | "deposit" | "pay_at_location" | "unknown";

export type PricingLineView = {
  id: string;
  label: string;
  amountLabel: string;
  kind: "base" | "fee" | "discount" | "tax" | "other";
};

export type QuotePolicyView = {
  summary?: string;
  fullText?: string;
  rescheduleSummary?: string;
  refundability?: string;
  consentRequired: boolean;
  consentLabel?: string;
};

export type QuoteServiceSnapshot = {
  name: string;
  durationMinutes?: number;
  imageUrl?: string;
  shortDescription?: string;
};

export type QuoteProviderSnapshot = {
  mode: ProviderPreference["type"];
  name?: string;
  title?: string;
};

export type QuoteBranchSnapshot = {
  name: string;
  address?: string;
};

export type QuoteSlotSnapshot = {
  id?: string;
  startsAt?: string;
  endsAt?: string;
  label?: string;
};

export type BookingQuoteView = {
  id?: string;
  expiresAt?: string;
  serverNow?: string;
  timezone?: string;
  currency?: string;
  priceLabel?: string;
  depositLabel?: string;
  discountLabel?: string;
  taxLabel?: string;
  finalAmountLabel?: string;
  payableNowLabel?: string;
  payableAtLocationLabel?: string;
  durationMinutes?: number;
  policy?: string;
  service?: QuoteServiceSnapshot;
  provider?: QuoteProviderSnapshot;
  branch?: QuoteBranchSnapshot;
  slot?: QuoteSlotSnapshot;
  lines: PricingLineView[];
  policySnapshot?: QuotePolicyView;
  paymentMode: QuotePaymentMode;
  checkoutPath: CheckoutPath;
  paymentOptions: PaymentOptionView[];
  coupon?: CouponView;
  changed: boolean;
  policyChanged: boolean;
  authoritative: boolean;
};

export type BookingConfirmView = {
  outcome: "confirmed" | "payment_required" | "held" | "quote_changed" | "missing_endpoint";
  bookingId?: string;
  reference?: string;
  holdId?: string;
  quote?: BookingQuoteView;
};

export type StepCompositionContext = {
  serviceSelected: boolean;
  branchesEnabled: boolean;
  eligibleBranchCount: number;
  branchesResolved: boolean;
  providerMode: ProviderSelectionMode;
  providersResolved: boolean;
  additionalFieldCount: number;
  fieldsResolved: boolean;
};

export const BOOKING_STEP_LABELS: Record<BookingStepId, string> = {
  service: "خدمت",
  branch: "شعبه",
  provider: "متخصص",
  date: "تاریخ",
  time: "ساعت",
  details: "اطلاعات تکمیلی",
  summary: "خلاصه",
  checkout: "تأیید",
};

export const emptyBookingDraft = (): BookingDraft => ({
  serviceId: null,
  branchId: null,
  providerPreference: { type: "not_applicable" },
  date: null,
  slotId: null,
  additionalData: {},
});
