import type { StatusKey } from "@/lib/status/status-map";
import type { PolicySnapshot, PublicBusinessContact } from "@/types/appointment-detail";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

export type RescheduleAppointmentSnapshot = {
  publicReference: string;
  status: StatusKey;
  serviceId: string;
  serviceName: string;
  provider?: AppointmentProviderSnapshot;
  branchId?: string;
  branchName?: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  durationMinutes?: number;
  paymentStatus?: StatusKey;
};

export type RescheduleSelectionContext = {
  serviceId: string;
  branchId?: string;
  providerPreference: ProviderPreference;
  requiresBranch: boolean;
  providerMode: ProviderSelectionMode;
  timezone?: string;
};

export type RescheduleChangePermissions = {
  allowBranchChange: boolean;
  allowProviderChange: boolean;
};

export type RescheduleFinancialAdjustment = {
  status:
    | "none"
    | "additional_payment"
    | "partial_refund"
    | "refund_pending"
    | "payment_pending"
    | "pending_calculation";
  currentAmountLabel?: string;
  newAmountLabel?: string;
  differenceLabel?: string;
  depositLabel?: string;
  refundLabel?: string;
  note?: string;
  payHref?: string;
  holdReference?: string;
  expiresAt?: string;
};

export type RescheduleProposedSnapshot = {
  date: string;
  slotId: string;
  startsAt: string;
  endsAt?: string;
  timeLabel?: string;
  provider?: AppointmentProviderSnapshot;
  branchId?: string;
  branchName?: string;
};

export type ReschedulePreviewView = {
  appointment: RescheduleAppointmentSnapshot;
  canReschedule: boolean;
  blockedReason?: string;
  policy: PolicySnapshot;
  selection: RescheduleSelectionContext;
  permissions: RescheduleChangePermissions;
  previewVersion?: string;
  expiresAt?: string;
  warning?: string;
  requiresAcknowledgment?: boolean;
  acknowledgmentLabel?: string;
  remainingReschedulesLabel?: string;
  contact?: PublicBusinessContact;
};

export type RescheduleQuoteView = {
  previewVersion?: string;
  current: RescheduleAppointmentSnapshot;
  proposed: RescheduleProposedSnapshot;
  financial: RescheduleFinancialAdjustment;
  policy: PolicySnapshot;
  warning?: string;
  requiresAcknowledgment?: boolean;
  acknowledgmentLabel?: string;
};

export type RescheduleResultView = {
  appointmentReference: string;
  status: StatusKey;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  provider?: AppointmentProviderSnapshot;
  branchName?: string;
  rescheduledAt?: string;
  financial: RescheduleFinancialAdjustment;
  message?: string;
  paymentRequired?: boolean;
};
