import type { ServiceDepositKind, ServicePriceKind } from "@/types/service";

export type AdminServiceLifecycle = "active" | "inactive" | "archived" | "unknown";

export type AdminServiceActiveFilter = "all" | "active" | "inactive" | "archived";

export type AdminServiceSortField =
  | "name"
  | "duration"
  | "price"
  | "sortOrder"
  | "updatedAt"
  | "createdAt";

export type AdminServiceSortDirection = "asc" | "desc";

export type AdminServiceDepositMode = "none" | "fixed" | "percentage";

export type AdminServiceProviderMode = "selectable" | "auto" | "none" | "unknown";

export type AdminServicePriceMode = ServicePriceKind;

export type AdminServiceAllowedActions = {
  view?: boolean;
  edit?: boolean;
  editContent?: boolean;
  managePricing?: boolean;
  manageProviders?: boolean;
  manageResources?: boolean;
  manageBranches?: boolean;
  changeStatus?: boolean;
  activate?: boolean;
  deactivate?: boolean;
  archive?: boolean;
  delete?: boolean;
  reorder?: boolean;
  uploadImage?: boolean;
  viewPreview?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminServiceListFilters = {
  q?: string;
  active: AdminServiceActiveFilter;
  branchId?: string;
  providerId?: string;
  resourceType?: string;
  sort: AdminServiceSortField;
  direction: AdminServiceSortDirection;
  page: number;
};

export type AdminServiceBranchAssignment = {
  id: string;
  name: string;
};

export type AdminServiceProviderAssignment = {
  id: string;
  name: string;
  customerVisible?: boolean;
};

export type AdminServiceImageView = {
  imageUrl?: string;
  alt?: string;
};

export type AdminServicePricingView = {
  priceMode: AdminServicePriceMode;
  priceLabel: string;
  price?: number;
  currency?: string;
  depositMode: AdminServiceDepositMode;
  depositLabel?: string;
  depositAmount?: number;
  depositPercent?: number;
};

export type AdminServiceListItem = {
  id: string;
  reference: string;
  name: string;
  image?: AdminServiceImageView;
  durationMinutes?: number;
  pricing: AdminServicePricingView;
  capacity?: number;
  branches: AdminServiceBranchAssignment[];
  providerCount?: number;
  requirementSummary?: string[];
  lifecycle: AdminServiceLifecycle;
  lifecycleLabel: string;
  sortOrder?: number;
  bookingEnabled: boolean;
  detailHref: string;
  editHref: string;
  resourcesHref: string;
  allowedActions: AdminServiceAllowedActions;
};

export type AdminServiceFilterOptions = {
  branches?: Array<{ id: string; name: string }>;
  providers?: Array<{ id: string; name: string }>;
  resourceTypes?: Array<{ value: string; label: string }>;
  categories?: Array<{ id: string; name: string }>;
};

export type AdminServiceListView = {
  items: AdminServiceListItem[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  filtersApplied: boolean;
  emptyCatalog: boolean;
  filterOptions?: AdminServiceFilterOptions;
};

export type AdminServiceDetailView = {
  id: string;
  reference: string;
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  image?: AdminServiceImageView;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  capacity?: number;
  capacityLabel?: string;
  capacityHelp?: string;
  pricing: AdminServicePricingView;
  branches: AdminServiceBranchAssignment[];
  providers: AdminServiceProviderAssignment[];
  providerMode: AdminServiceProviderMode;
  providerModeLabel?: string;
  categoryId?: string;
  categoryName?: string;
  requirementSummary?: string[];
  lifecycle: AdminServiceLifecycle;
  lifecycleLabel: string;
  sortOrder?: number;
  bookingEnabled: boolean;
  customerPreviewActive: boolean;
  detailHref: string;
  editHref: string;
  resourcesHref: string;
  publicHref?: string;
  allowedActions: AdminServiceAllowedActions;
  version?: string;
  updatedAt?: string;
  capabilities: AdminServiceCapabilities;
};

export type AdminServiceCapabilities = {
  hasMultiBranch: boolean;
  hasProviderAssignment: boolean;
  hasResourceRequirements: boolean;
  hasImageUpload: boolean;
  hasPricing: boolean;
  hasDeposit: boolean;
  hasCapacity: boolean;
  hasBuffers: boolean;
  hasSortOrder: boolean;
  hasCategories: boolean;
  hasImpactPreview: boolean;
  atomicSave: boolean;
};

export type AdminServiceFormInput = {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  capacity?: number;
  priceMode: AdminServicePriceMode;
  price?: number;
  currency?: string;
  depositMode: AdminServiceDepositMode;
  depositAmount?: number;
  depositPercent?: number;
  branchIds: string[];
  providerIds: string[];
  providerMode: AdminServiceProviderMode;
  categoryId?: string;
  sortOrder?: number;
  bookingEnabled: boolean;
  version?: string;
};

export type AdminServiceImpactAction =
  | "deactivate"
  | "activate"
  | "archive"
  | "delete";

export type AdminServiceFormImpactField =
  | "duration"
  | "buffers"
  | "capacity"
  | "branches"
  | "providers"
  | "status"
  | "requirements";

export type AdminServiceImpactPreview = {
  action?: AdminServiceImpactAction;
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  waitingListCount?: number;
  availabilityAffected?: boolean;
  branchWarnings?: string[];
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminServiceMutationResult = {
  reference: string;
  version?: string;
  updatedAt?: string;
};

export const ADMIN_SERVICE_LIST_LIMIT = 20;

export const ADMIN_SERVICE_ACTIVE_FILTERS: readonly AdminServiceActiveFilter[] = [
  "all",
  "active",
  "inactive",
  "archived",
];

export const ADMIN_SERVICE_SORT_FIELDS: readonly AdminServiceSortField[] = [
  "name",
  "duration",
  "price",
  "sortOrder",
  "updatedAt",
  "createdAt",
];

export const ADMIN_SERVICE_LIFECYCLE_LABELS: Record<
  Exclude<AdminServiceLifecycle, "unknown">,
  string
> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
};

export const ADMIN_SERVICE_ACTIVE_FILTER_LABELS: Record<AdminServiceActiveFilter, string> = {
  all: "همه",
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
};

export const ADMIN_SERVICE_SORT_LABELS: Record<AdminServiceSortField, string> = {
  name: "نام",
  duration: "مدت",
  price: "قیمت",
  sortOrder: "ترتیب نمایش",
  updatedAt: "آخرین به‌روزرسانی",
  createdAt: "تاریخ ایجاد",
};

export const ADMIN_SERVICE_DEPOSIT_MODE_LABELS: Record<AdminServiceDepositMode, string> = {
  none: "بدون بیعانه",
  fixed: "مبلغ ثابت",
  percentage: "درصد",
};

export const ADMIN_SERVICE_PROVIDER_MODE_LABELS: Record<
  Exclude<AdminServiceProviderMode, "unknown">,
  string
> = {
  selectable: "قابل انتخاب توسط مشتری",
  auto: "تخصیص خودکار",
  none: "بدون Provider عمومی",
};

export const ADMIN_SERVICE_FORM_TABS = [
  { id: "basic", label: "اطلاعات پایه" },
  { id: "presentation", label: "نمایش مشتری" },
  { id: "scheduling", label: "مدت و ظرفیت" },
  { id: "pricing", label: "قیمت و بیعانه" },
  { id: "assignments", label: "Provider و شعب" },
  { id: "requirements", label: "نیازمندی‌های منبع" },
  { id: "status", label: "وضعیت و ترتیب" },
] as const;

export type AdminServiceFormTabId = (typeof ADMIN_SERVICE_FORM_TABS)[number]["id"];
