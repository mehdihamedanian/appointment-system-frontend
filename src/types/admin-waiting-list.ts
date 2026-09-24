import type {
  WaitingListDatePreference,
  WaitingListEntryStatus,
  WaitingListOfferStatus,
  WaitingListTimePreference,
} from "@/types/waiting-list";
import type { ProviderPreference } from "@/types/provider";

export const ADMIN_WAITING_LIST_MANAGEMENT_ENABLED = true;
export const ADMIN_WAITING_LIST_LIST_LIMIT = 20;

export const ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS = [
  "all",
  "active",
  "offered",
  "accepted",
  "rejected",
  "expired",
  "fulfilled",
  "cancelled",
  "removed",
] as const;

export type AdminWaitingListEntryStatusFilter =
  (typeof ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS)[number];

export const ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS = [
  "all",
  "none",
  "pending",
  "accepted",
  "rejected",
  "expired",
  "slot_taken",
  "cancelled",
] as const;

export type AdminWaitingListOfferStatusFilter =
  (typeof ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS)[number];

export const ADMIN_WAITING_LIST_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "preferredDate",
  "customer",
  "service",
  "entryStatus",
  "offerStatus",
] as const;

export type AdminWaitingListSortField = (typeof ADMIN_WAITING_LIST_SORT_FIELDS)[number];
export type AdminWaitingListSortDirection = "asc" | "desc";

export type AdminWaitingListListFilters = {
  q?: string;
  entryStatus: AdminWaitingListEntryStatusFilter;
  offerStatus: AdminWaitingListOfferStatusFilter;
  serviceId?: string;
  providerId?: string;
  branchId?: string;
  preferredFrom?: string;
  preferredTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sort: AdminWaitingListSortField;
  direction: AdminWaitingListSortDirection;
  page: number;
};

export type AdminWaitingListAllowedActions = {
  view?: boolean;
  viewContact?: boolean;
  create?: boolean;
  sendOffer?: boolean;
  remove?: boolean;
  cancel?: boolean;
  close?: boolean;
  viewOfferHistory?: boolean;
  viewNotifications?: boolean;
  retryNotification?: boolean;
  editNotes?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminWaitingListCapabilities = {
  supportsImpactPreview?: boolean;
  supportsDuplicateCheck?: boolean;
  supportsManualEntry?: boolean;
  supportsWaitingListAvailability?: boolean;
  supportsNotificationRetry?: boolean;
};

export type AdminWaitingListCustomerSummary = {
  reference: string;
  displayName: string;
  phoneMasked?: string;
  emailMasked?: string;
  href?: string;
};

export type AdminWaitingListOfferHistoryItem = {
  id: string;
  publicReference: string;
  status: WaitingListOfferStatus;
  statusLabel: string;
  whenLabel?: string;
  expiresAtLabel?: string;
  createdAtLabel?: string;
  sentByLabel?: string;
  href?: string;
};

export type AdminWaitingListNotificationStatus = {
  state: "unknown" | "pending" | "sent" | "delivered" | "failed" | "not_requested";
  stateLabel: string;
  channelLabel?: string;
  lastAttemptLabel?: string;
  failureReason?: string;
  canRetry?: boolean;
};

export type AdminWaitingListListItemView = {
  reference: string;
  customer: AdminWaitingListCustomerSummary;
  serviceName: string;
  providerLabel?: string;
  branchName?: string;
  datePreferenceLabel?: string;
  timePreferenceLabel?: string;
  entryStatus: WaitingListEntryStatus;
  entryStatusLabel: string;
  offerStatus?: WaitingListOfferStatus;
  offerStatusLabel?: string;
  offerExpiresAt?: string;
  offerServerNow?: string;
  createdAtLabel?: string;
  detailHref: string;
  offerHref?: string;
  canViewDetail: boolean;
  canSendOffer: boolean;
};

export type AdminWaitingListListView = {
  items: AdminWaitingListListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminWaitingListFilterOptions;
};

export type AdminWaitingListFilterOptions = {
  services?: Array<{ id: string; name: string }>;
  providers?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
};

export type AdminWaitingListDetailView = {
  reference: string;
  customer: AdminWaitingListCustomerSummary;
  contactPhone?: string;
  contactEmail?: string;
  serviceName: string;
  serviceId?: string;
  providerLabel?: string;
  branchName?: string;
  branchId?: string;
  datePreferenceLabel?: string;
  timePreferenceLabel?: string;
  customerNote?: string;
  internalNotes: Array<{ id: string; body: string; authorLabel?: string; createdAtLabel?: string }>;
  entryStatus: WaitingListEntryStatus;
  entryStatusLabel: string;
  activeOffer?: {
    publicReference: string;
    status: WaitingListOfferStatus;
    statusLabel: string;
    whenLabel?: string;
    expiresAt?: string;
    serverNow?: string;
    priceLabel?: string;
    depositLabel?: string;
    href?: string;
  };
  offerHistory: AdminWaitingListOfferHistoryItem[];
  notification?: AdminWaitingListNotificationStatus;
  appointmentReference?: string;
  appointmentHref?: string;
  createdAtLabel?: string;
  updatedAtLabel?: string;
  allowedActions: AdminWaitingListAllowedActions;
  capabilities: AdminWaitingListCapabilities;
  version?: string;
};

export type AdminWaitingListManualEntryInput = {
  customerReference: string;
  serviceId: string;
  branchId?: string;
  providerPreference: ProviderPreference;
  datePreference: WaitingListDatePreference;
  timePreference: WaitingListTimePreference;
  timeFrom?: string;
  timeTo?: string;
  customerNote?: string;
  internalNote?: string;
};

export type AdminWaitingListManualEntryErrors = Partial<
  Record<
    | "customerReference"
    | "serviceId"
    | "branchId"
    | "serviceIds"
    | "date"
    | "time"
    | "form",
    string
  >
>;

export type AdminWaitingListImpactAction = "remove" | "cancel" | "close";

export type AdminWaitingListImpactPreview = {
  title: string;
  summary?: string;
  effects: string[];
  activeOfferAffected?: boolean;
  notificationAffected?: boolean;
  requiresReason?: boolean;
  reasonOptions?: Array<{ id: string; label: string }>;
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminWaitingListOfferEligibility = {
  eligible: boolean;
  reason?: string;
  hasActiveOffer?: boolean;
  entryStatus?: WaitingListEntryStatus;
};

export type AdminWaitingListAvailabilityDay = {
  date: string;
  label?: string;
  hasSlots?: boolean;
};

export type AdminWaitingListAvailabilitySlot = {
  id: string;
  startsAt: string;
  label: string;
  providerName?: string;
  branchName?: string;
  available?: boolean;
};

export type AdminWaitingListOfferExpirationOption = {
  id: string;
  label: string;
  minutes?: number;
};

export type AdminWaitingListOfferPreview = {
  title?: string;
  summary?: string;
  serviceName: string;
  branchName?: string;
  providerName?: string;
  slotLabel: string;
  priceLabel?: string;
  depositLabel?: string;
  policySummary?: string;
  nextStepLabel?: string;
  expirationOptions: AdminWaitingListOfferExpirationOption[];
  defaultExpirationId?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminWaitingListOfferSendResult = {
  entryReference: string;
  offerReference: string;
  offerStatus: WaitingListOfferStatus;
  offerStatusLabel: string;
  expiresAt?: string;
  serverNow?: string;
  notification?: AdminWaitingListNotificationStatus;
  version?: string;
  message?: string;
};

export type AdminWaitingListDuplicateCheck = {
  duplicate: boolean;
  message?: string;
  existingReference?: string;
  existingHref?: string;
};

export const ADMIN_WAITING_LIST_ENTRY_STATUS_FILTER_LABELS: Record<
  AdminWaitingListEntryStatusFilter,
  string
> = {
  all: "همه وضعیت‌های درخواست",
  active: "فعال",
  offered: "پیشنهاد زمان",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  fulfilled: "تبدیل به نوبت",
  cancelled: "لغوشده",
  removed: "حذف‌شده",
};

export const ADMIN_WAITING_LIST_OFFER_STATUS_FILTER_LABELS: Record<
  AdminWaitingListOfferStatusFilter,
  string
> = {
  all: "همه وضعیت‌های پیشنهاد",
  none: "بدون پیشنهاد فعال",
  pending: "در انتظار پاسخ",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  slot_taken: "زمان گرفته شد",
  cancelled: "لغوشده",
};

export const ADMIN_WAITING_LIST_SORT_LABELS: Record<AdminWaitingListSortField, string> = {
  createdAt: "تاریخ ثبت",
  updatedAt: "به‌روزرسانی",
  preferredDate: "تاریخ ترجیحی",
  customer: "مشتری",
  service: "خدمت",
  entryStatus: "وضعیت درخواست",
  offerStatus: "وضعیت پیشنهاد",
};
