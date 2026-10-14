import type { StatusKey } from "@/lib/status/status-map";

export type ConfirmationResultKind =
  | "confirmed"
  | "scheduled"
  | "pending"
  | "pay_at_location"
  | "payment_pending"
  | "unknown";

export type ConfirmationProviderView = {
  mode: "specific" | "assigned" | "pending_assignment" | "not_applicable";
  name?: string;
  title?: string;
};

export type ConfirmationBranchView = {
  name: string;
  address?: string;
  phone?: string;
  directionsUrl?: string;
};

export type ConfirmationPricingView = {
  totalLabel?: string;
  paidLabel?: string;
  remainingLabel?: string;
  currency?: string;
};

export type BookingConfirmationView = {
  id: string;
  reference?: string;
  status: StatusKey;
  paymentStatus?: StatusKey;
  serviceName: string;
  provider?: ConfirmationProviderView;
  branch?: ConfirmationBranchView;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  durationMinutes?: number;
  pricing: ConfirmationPricingView;
  transactionReference?: string;
  instructions?: string;
  /** Present only when the Backend's `actions.can_pay` allows online payment. */
  payHref?: string;
};
