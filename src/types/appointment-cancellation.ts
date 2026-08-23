import type { StatusKey } from "@/lib/status/status-map";
import type { PolicySnapshot } from "@/types/appointment-detail";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";

export type CancellationRefundStatus =
  | "none"
  | "full"
  | "partial"
  | "pending_calculation"
  | "already_refunded"
  | "processing";

export type MoneyLabel = {
  label?: string;
};

export type CancellationReasonOption = {
  code: string;
  label: string;
  requiresText?: boolean;
  maxLength?: number;
};

export type CancellationAppointmentSnapshot = {
  publicReference: string;
  status: StatusKey;
  serviceName: string;
  provider?: AppointmentProviderSnapshot;
  branchName?: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  durationMinutes?: number;
  paymentStatus?: StatusKey;
};

export type CancellationRefundView = {
  status: CancellationRefundStatus;
  paidAmount?: MoneyLabel;
  cancellationFee?: MoneyLabel;
  refundableAmount?: MoneyLabel;
  methodLabel?: string;
  processingEstimate?: string;
  note?: string;
};

export type CancellationPreviewView = {
  appointment: CancellationAppointmentSnapshot;
  canCancel: boolean;
  blockedReason?: string;
  policy: PolicySnapshot;
  refund: CancellationRefundView;
  allowedReasons?: CancellationReasonOption[];
  previewVersion?: string;
  expiresAt?: string;
  reasonMaxLength?: number;
};

export type CancellationResultView = {
  appointmentReference: string;
  status: StatusKey;
  cancelledAt?: string;
  cancellationReference?: string;
  refund: CancellationRefundView;
  message?: string;
};

export const DEFAULT_CANCELLATION_REASON_MAX_LENGTH = 500;
