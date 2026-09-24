export const ADMIN_COUPON_LIST_LIMIT = 20;
export const ADMIN_COUPON_MANAGEMENT_ENABLED = true;

export const ADMIN_COUPON_STATUS_FILTERS = [
  "all",
  "draft",
  "scheduled",
  "active",
  "paused",
  "expired",
  "exhausted",
  "archived",
] as const;

export type AdminCouponStatusFilter = (typeof ADMIN_COUPON_STATUS_FILTERS)[number];

export const ADMIN_COUPON_DISCOUNT_TYPE_FILTERS = ["all", "fixed", "percentage"] as const;

export type AdminCouponDiscountTypeFilter = (typeof ADMIN_COUPON_DISCOUNT_TYPE_FILTERS)[number];

export const ADMIN_COUPON_VALIDITY_FILTERS = ["all", "upcoming", "current", "past"] as const;

export type AdminCouponValidityFilter = (typeof ADMIN_COUPON_VALIDITY_FILTERS)[number];

export const ADMIN_COUPON_SORT_FIELDS = ["code", "title", "status", "startsAt", "endsAt", "usageCount", "updatedAt"] as const;

export type AdminCouponSortField = (typeof ADMIN_COUPON_SORT_FIELDS)[number];
export type AdminCouponSortDirection = "asc" | "desc";

export type AdminCouponLifecycle =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "expired"
  | "exhausted"
  | "archived"
  | "unknown";

export type AdminCouponDiscountType = "fixed" | "percentage";

export type AdminCouponServiceScope = "all" | "include" | "exclude";

export type AdminCouponListFilters = {
  q?: string;
  status: AdminCouponStatusFilter;
  discountType: AdminCouponDiscountTypeFilter;
  validity: AdminCouponValidityFilter;
  serviceId?: string;
  branchId?: string;
  sort: AdminCouponSortField;
  direction: AdminCouponSortDirection;
  page: number;
};

export type AdminCouponAllowedActions = {
  view?: boolean;
  edit?: boolean;
  create?: boolean;
  pause?: boolean;
  activate?: boolean;
  archive?: boolean;
  delete?: boolean;
  editCode?: boolean;
  editDiscount?: boolean;
  editRestrictions?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminCouponCapabilities = {
  supportsCustomerRestrictions?: boolean;
  supportsBranchRestrictions?: boolean;
  supportsImpactPreview?: boolean;
  supportsUsageHistory?: boolean;
  supportsDraft?: boolean;
};

export type AdminCouponUsageStats = {
  confirmedUsage?: number;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  remainingUsage?: number;
  uniqueCustomers?: number;
  totalDiscountedLabel?: string;
  usageLimitLabel?: string;
  periodLabel?: string;
};

export type AdminCouponListItemView = {
  reference: string;
  code: string;
  title: string;
  discountType: AdminCouponDiscountType;
  discountTypeLabel: string;
  discountValueLabel: string;
  lifecycle: AdminCouponLifecycle;
  lifecycleLabel: string;
  validityLabel?: string;
  startsAtLabel?: string;
  endsAtLabel?: string;
  timezoneLabel?: string;
  usageCountLabel?: string;
  usageLimitLabel?: string;
  detailHref: string;
  editHref: string;
  canViewDetail: boolean;
  canEdit: boolean;
  canPause: boolean;
  canActivate: boolean;
};

export type AdminCouponListView = {
  items: AdminCouponListItemView[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  emptyHistory: boolean;
  filtersApplied: boolean;
  filterOptions?: AdminCouponFilterOptions;
};

export type AdminCouponFilterOptions = {
  services?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
};

export type AdminCouponRestrictionView = {
  serviceScope: AdminCouponServiceScope;
  serviceIds: string[];
  serviceLabels: string[];
  branchIds: string[];
  branchLabels: string[];
  customerRestrictionLabel?: string;
  minimumAmountLabel?: string;
  maximumDiscountLabel?: string;
};

export type AdminCouponUsageHistoryItem = {
  id: string;
  usedAtLabel?: string;
  customerLabel?: string;
  appointmentReference?: string;
  discountLabel?: string;
  statusLabel?: string;
};

export type AdminCouponDetailView = {
  reference: string;
  code: string;
  title: string;
  internalDescription?: string;
  customerDescription?: string;
  discountType: AdminCouponDiscountType;
  discountTypeLabel: string;
  discountValueLabel: string;
  lifecycle: AdminCouponLifecycle;
  lifecycleLabel: string;
  startsAt?: string;
  endsAt?: string;
  startsAtLabel?: string;
  endsAtLabel?: string;
  timezoneLabel?: string;
  serverStatusLabel?: string;
  serverTimeLabel?: string;
  restrictions: AdminCouponRestrictionView;
  stats: AdminCouponUsageStats;
  usageHistory: AdminCouponUsageHistoryItem[];
  ruleSummary?: string;
  allowedActions: AdminCouponAllowedActions;
  capabilities: AdminCouponCapabilities;
  version?: string;
  createdAtLabel?: string;
  updatedAtLabel?: string;
  authorLabel?: string;
};

export type AdminCouponFormInput = {
  code: string;
  title: string;
  internalDescription?: string;
  customerDescription?: string;
  discountType: AdminCouponDiscountType;
  discountValue: string;
  maximumDiscount?: string;
  minimumAmount?: string;
  startsAt: string;
  startsTime: string;
  endsAt: string;
  endsTime: string;
  totalUsageLimit?: string;
  perCustomerLimit?: string;
  serviceScope: AdminCouponServiceScope;
  serviceIds: string[];
  branchIds: string[];
  draft: boolean;
};

export type AdminCouponFormErrors = Partial<
  Record<
    | "code"
    | "title"
    | "discountValue"
    | "maximumDiscount"
    | "minimumAmount"
    | "startsAt"
    | "endsAt"
    | "totalUsageLimit"
    | "perCustomerLimit"
    | "serviceIds"
    | "branchIds"
    | "form",
    string
  >
>;

export type AdminCouponImpactAction = "pause" | "activate" | "archive" | "edit";

export type AdminCouponImpactPreview = {
  title: string;
  summary?: string;
  effects: string[];
  existingBookingsUnchanged?: boolean;
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminCouponMutationResult = {
  reference: string;
  version?: string;
};

export const ADMIN_COUPON_STATUS_LABELS: Record<AdminCouponStatusFilter, string> = {
  all: "همه وضعیت‌ها",
  draft: "پیش‌نویس",
  scheduled: "زمان‌بندی‌شده",
  active: "فعال",
  paused: "متوقف",
  expired: "منقضی",
  exhausted: "تمام‌شده",
  archived: "بایگانی",
};

export const ADMIN_COUPON_DISCOUNT_TYPE_LABELS: Record<AdminCouponDiscountTypeFilter, string> = {
  all: "همه انواع",
  fixed: "مبلغ ثابت",
  percentage: "درصدی",
};

export const ADMIN_COUPON_VALIDITY_LABELS: Record<AdminCouponValidityFilter, string> = {
  all: "همه بازه‌ها",
  upcoming: "آینده",
  current: "جاری",
  past: "گذشته",
};

export const ADMIN_COUPON_LIFECYCLE_LABELS: Record<AdminCouponLifecycle, string> = {
  draft: "پیش‌نویس",
  scheduled: "زمان‌بندی‌شده",
  active: "فعال",
  paused: "متوقف",
  expired: "منقضی",
  exhausted: "تمام‌شده",
  archived: "بایگانی",
  unknown: "نامشخص",
};

export const ADMIN_COUPON_SORT_LABELS: Record<AdminCouponSortField, string> = {
  code: "کد",
  title: "عنوان",
  status: "وضعیت",
  startsAt: "شروع",
  endsAt: "پایان",
  usageCount: "مصرف",
  updatedAt: "به‌روزرسانی",
};

export const ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS: Record<AdminCouponDiscountType, string> = {
  fixed: "مبلغ ثابت",
  percentage: "درصد",
};

export const ADMIN_COUPON_SERVICE_SCOPE_LABELS: Record<AdminCouponServiceScope, string> = {
  all: "همه خدمات",
  include: "فقط خدمات انتخاب‌شده",
  exclude: "به‌جز خدمات انتخاب‌شده",
};
