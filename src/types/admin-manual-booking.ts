import type { BookingQuoteView } from "@/types/booking";
import type { ProviderPreference } from "@/types/provider";

export type AdminManualBookingStepId =
  | "customer"
  | "service"
  | "provider"
  | "datetime"
  | "resources"
  | "details"
  | "review"
  | "success";

export const ADMIN_MANUAL_BOOKING_STEP_LABELS: Record<AdminManualBookingStepId, string> = {
  customer: "مشتری",
  service: "خدمت و شعبه",
  provider: "متخصص",
  datetime: "تاریخ و ساعت",
  resources: "تخصیص منابع",
  details: "پرداخت و یادداشت",
  review: "بررسی",
  success: "ثبت شد",
};

export type AdminManualBookingCustomerView = {
  id: string;
  displayName: string;
  reference?: string;
  phone?: string;
  phoneMasked?: string;
  email?: string;
  emailMasked?: string;
  canViewContact: boolean;
};

export type AdminManualBookingCustomerSearchView = {
  items: AdminManualBookingCustomerView[];
  query: string;
  empty: boolean;
};

export type AdminManualBookingCreateCustomerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
};

export type AdminManualBookingCreateCustomerResult =
  | { outcome: "created"; customer: AdminManualBookingCustomerView }
  | { outcome: "duplicate"; customer: AdminManualBookingCustomerView; message?: string }
  | { outcome: "missing_endpoint" };

export type AdminResourceAllocationItemView = {
  id: string;
  name: string;
  kind: "staff" | "room" | "device" | "chair" | "desk" | "bed" | "equipment" | "other";
  required?: boolean;
};

export type AdminResourceAllocationGroupView = {
  id: string;
  label: string;
  mode: "automatic" | "select" | "override";
  items: AdminResourceAllocationItemView[];
  selectedIds?: string[];
  /** At most one resource may be chosen (Backend `resource_selections` is one per requirement). */
  single?: boolean;
};

export type AdminResourceAllocationView = {
  mode: "automatic" | "select" | "override";
  automaticSummary?: string;
  groups: AdminResourceAllocationGroupView[];
  canOverride: boolean;
  unavailableReason?: "missing_endpoint" | "not_required";
};

export type AdminManualPaymentMethodType =
  | "full"
  | "deposit"
  | "pay_at_location"
  | "cash"
  | "pos"
  | "bank_transfer"
  | "recorded"
  | "none";

export type AdminManualPaymentOptionView = {
  type: AdminManualPaymentMethodType;
  title: string;
  description: string;
  payableNowLabel?: string;
  remainingAtLocationLabel?: string;
  remainingDueLabel?: string;
};

export type AdminManualBookingSourceOption = {
  value: string;
  label: string;
};

export type AdminManualBookingOptionsView = {
  bookingSources: AdminManualBookingSourceOption[];
  defaultBookingSource?: string;
};

export type AdminManualBookingDraft = {
  customerId: string | null;
  serviceId: string | null;
  branchId: string | null;
  providerPreference: ProviderPreference;
  date: string | null;
  slotId: string | null;
  allocationMode: "automatic" | "select" | "override";
  resourceSelections: Record<string, string[]>;
  quoteId?: string;
  paymentMethod?: AdminManualPaymentMethodType;
  bookingSource?: string;
  customerNote?: string;
  internalNote?: string;
};

export type AdminManualBookingQuoteView = Omit<BookingQuoteView, "paymentOptions"> & {
  paymentOptions: AdminManualPaymentOptionView[];
  allocation?: AdminResourceAllocationView;
  bookingSources?: AdminManualBookingSourceOption[];
};

export type AdminManualBookingConfirmOutcome =
  | "confirmed"
  | "quote_changed"
  | "missing_endpoint";

export type AdminManualBookingConfirmView = {
  outcome: AdminManualBookingConfirmOutcome;
  reference?: string;
  appointmentId?: string;
  paymentStatus?: string;
  paymentStatusLabel?: string;
  quote?: AdminManualBookingQuoteView;
  allocationSummary?: string;
};

export type AdminManualBookingSuccessView = {
  reference: string;
  customerName: string;
  serviceName: string;
  providerName?: string;
  branchName?: string;
  startsAtLabel: string;
  paymentStatusLabel?: string;
  allocationSummary?: string;
};

export type AdminManualBookingNotice =
  | "slot_taken"
  | "quote_changed"
  | "quote_expired"
  | "resource_conflict"
  | "confirm_uncertain";

export const emptyAdminManualBookingDraft = (): AdminManualBookingDraft => ({
  customerId: null,
  serviceId: null,
  branchId: null,
  providerPreference: { type: "not_applicable" },
  date: null,
  slotId: null,
  allocationMode: "automatic",
  resourceSelections: {},
});
