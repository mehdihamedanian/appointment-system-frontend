import type { StatusKey } from "@/lib/status/status-map";
import type {
  AppointmentActionsView,
  AppointmentProviderSnapshot,
} from "@/types/appointment-list";

export type AppointmentDetailServiceSnapshot = {
  id?: string;
  name: string;
  durationMinutes?: number;
  description?: string;
  imageUrl?: string;
};

export type AppointmentDetailBranchSnapshot = {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  directionsUrl?: string;
  visitInstructions?: string;
};

export type PaymentSummaryView = {
  status?: StatusKey;
  totalLabel?: string;
  paidLabel?: string;
  depositLabel?: string;
  remainingLabel?: string;
  methodLabel?: string;
  transactionReference?: string;
  refundStatus?: StatusKey;
  receiptUrl?: string;
};

export type PolicySnapshot = {
  title?: string;
  summary?: string;
  deadlineLabel?: string;
  feeLabel?: string;
  refundLabel?: string;
  policyUrl?: string;
};

export type CustomerTimelineEvent = {
  id: string;
  title: string;
  description?: string;
  occurredAt?: string;
  state: "complete" | "current" | "upcoming" | "error";
};

export type PublicBusinessContact = {
  phone?: string;
  email?: string;
  address?: string;
  directionsUrl?: string;
  hoursLabel?: string;
  messageUrl?: string;
};

export type AppointmentDetailActionsView = AppointmentActionsView & {
  cancelBlockedReason?: string;
  rescheduleBlockedReason?: string;
  reviewBlockedReason?: string;
};

export type CustomerAppointmentDetailView = {
  id: string;
  publicReference: string;
  status: StatusKey;
  service: AppointmentDetailServiceSnapshot;
  provider?: AppointmentProviderSnapshot;
  branch?: AppointmentDetailBranchSnapshot;
  singleBranch?: boolean;
  startsAt: string;
  endsAt?: string;
  durationMinutes?: number;
  timezone?: string;
  payment: PaymentSummaryView;
  customerNote?: string;
  embeddedTimeline?: CustomerTimelineEvent[];
  cancellationPolicy?: PolicySnapshot;
  reschedulePolicy?: PolicySnapshot;
  actions: AppointmentDetailActionsView;
  contact?: PublicBusinessContact;
  updatedAt?: string;
};
