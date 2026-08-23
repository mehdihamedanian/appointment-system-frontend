import type { ProviderPreference } from "@/types/provider";

export type WaitingListEntryStatus =
  | "active"
  | "offered"
  | "accepted"
  | "rejected"
  | "expired"
  | "fulfilled"
  | "cancelled"
  | "removed"
  | "unknown";

export type WaitingListOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "slot_taken"
  | "cancelled"
  | "unknown";

export type WaitingListTimePreference =
  | "any"
  | "morning"
  | "afternoon"
  | "evening"
  | "exact";

export type WaitingListDatePreference =
  | { mode: "any" }
  | { mode: "specific"; date: string }
  | { mode: "range"; from: string; to: string }
  | { mode: "multiple"; dates: string[] };

export type WaitingListJoinInput = {
  serviceId: string;
  branchId?: string;
  providerPreference: ProviderPreference;
  datePreference: WaitingListDatePreference;
  timePreference: WaitingListTimePreference;
  timeFrom?: string;
  timeTo?: string;
  note?: string;
  /** Optional booking-context date when joining from empty slots. */
  contextDate?: string;
};

export type WaitingListServiceSnapshot = {
  id?: string;
  name: string;
};

export type WaitingListBranchSnapshot = {
  id?: string;
  name: string;
};

export type WaitingListProviderSnapshot = {
  preference: ProviderPreference;
  name?: string;
  title?: string;
};

export type WaitingListOfferSummary = {
  publicReference: string;
  status: WaitingListOfferStatus;
  startsAt?: string;
  whenLabel?: string;
  expiresAt?: string;
  href?: string;
};

export type WaitingListEntryView = {
  id: string;
  publicReference: string;
  status: WaitingListEntryStatus;
  statusLabel: string;
  service: WaitingListServiceSnapshot;
  provider?: WaitingListProviderSnapshot;
  branch?: WaitingListBranchSnapshot;
  datePreferenceLabel?: string;
  timePreferenceLabel?: string;
  note?: string;
  createdAt: string;
  createdLabel?: string;
  activeOffer?: WaitingListOfferSummary;
  canLeave: boolean;
  canViewOffer: boolean;
};

export type WaitingListListView = {
  items: WaitingListEntryView[];
  page: number;
  pageCount?: number;
  hasMore: boolean;
  nextCursor?: string;
  empty: boolean;
};

export type WaitingListOfferView = {
  id: string;
  publicReference: string;
  entryReference?: string;
  status: WaitingListOfferStatus;
  statusLabel: string;
  service: WaitingListServiceSnapshot;
  providerName?: string;
  branchName?: string;
  startsAt: string;
  endsAt?: string;
  whenLabel: string;
  durationMinutes?: number;
  durationLabel?: string;
  priceLabel?: string;
  depositLabel?: string;
  expiresAt: string;
  serverNow?: string;
  policyWarning?: string;
  canAccept: boolean;
  canReject: boolean;
  rejectKeepsEntryActive?: boolean;
  rejectClosesEntry?: boolean;
};

export type WaitingListAcceptOutcome =
  | {
      outcome: "confirmed";
      bookingReference: string;
      message?: string;
    }
  | {
      outcome: "payment_required";
      paymentReference?: string;
      holdReference?: string;
      bookingReference?: string;
      message?: string;
    }
  | {
      outcome: "hold_created";
      holdReference: string;
      message?: string;
    }
  | {
      outcome: "expired";
      message?: string;
    }
  | {
      outcome: "slot_taken";
      message?: string;
    }
  | {
      outcome: "conflict";
      message?: string;
    }
  | {
      outcome: "already_accepted";
      bookingReference?: string;
      message?: string;
    }
  | {
      outcome: "additional_info_required";
      message?: string;
    }
  | {
      outcome: "unknown";
      message?: string;
    };

export type WaitingListEligibilityView = {
  eligible: boolean;
  reason?: string;
  serviceSupportsWaitingList?: boolean;
  capabilityEnabled?: boolean;
};

export const WAITING_LIST_LIST_LIMIT = 10;

export const WAITING_LIST_ENTRY_STATUS_LABELS: Record<WaitingListEntryStatus, string> = {
  active: "فعال",
  offered: "پیشنهاد زمان",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  fulfilled: "تبدیل به نوبت",
  cancelled: "لغوشده",
  removed: "حذف‌شده",
  unknown: "نامشخص",
};

export const WAITING_LIST_OFFER_STATUS_LABELS: Record<WaitingListOfferStatus, string> = {
  pending: "در انتظار پاسخ",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  slot_taken: "زمان گرفته شد",
  cancelled: "لغوشده",
  unknown: "نامشخص",
};

export const WAITING_LIST_TIME_PREFERENCE_LABELS: Record<WaitingListTimePreference, string> = {
  any: "هر ساعتی",
  morning: "صبح",
  afternoon: "بعدازظهر",
  evening: "عصر",
  exact: "بازه مشخص",
};

export const TERMINAL_ENTRY_STATUSES: WaitingListEntryStatus[] = [
  "accepted",
  "fulfilled",
  "cancelled",
  "removed",
  "expired",
];

export const TERMINAL_OFFER_STATUSES: WaitingListOfferStatus[] = [
  "accepted",
  "rejected",
  "expired",
  "slot_taken",
  "cancelled",
];
