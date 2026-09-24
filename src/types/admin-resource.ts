export type AdminResourceType =
  | "staff"
  | "room"
  | "device"
  | "desk"
  | "chair"
  | "bed"
  | "equipment"
  | "other"
  | "unknown";

export type AdminResourceLifecycle =
  | "active"
  | "inactive"
  | "archived"
  | "unknown";

export type AdminResourceScheduleMode =
  | "inherit_business"
  | "inherit_branch"
  | "custom"
  | "unknown";

export type AdminResourceActiveFilter = "all" | "active" | "inactive" | "archived";

export type AdminResourceSortField = "name" | "type" | "branch" | "capacity" | "updatedAt" | "createdAt";
export type AdminResourceSortDirection = "asc" | "desc";

export type AdminResourceAllowedActions = {
  view?: boolean;
  edit?: boolean;
  deactivate?: boolean;
  activate?: boolean;
  archive?: boolean;
  delete?: boolean;
  viewCalendar?: boolean;
  manageSchedule?: boolean;
  changeBranch?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminResourceListFilters = {
  q?: string;
  type: string;
  branchId?: string;
  serviceId?: string;
  active: AdminResourceActiveFilter;
  sort: AdminResourceSortField;
  direction: AdminResourceSortDirection;
  page: number;
};

export type AdminResourceBranchSnapshot = {
  id: string;
  name: string;
};

export type AdminResourceScheduleSummary = {
  mode: AdminResourceScheduleMode;
  sourceLabel?: string;
  summary?: string;
  workingHoursLabel?: string;
  breaksLabel?: string;
  timeOffLabel?: string;
  blockTimeLabel?: string;
};

export type AdminResourceCapacityView = {
  value?: number;
  min?: number;
  max?: number;
  editable: boolean;
  semanticsLabel?: string;
  label?: string;
};

export type AdminResourceListItem = {
  id: string;
  reference: string;
  name: string;
  type: AdminResourceType;
  typeLabel: string;
  description?: string;
  branch?: AdminResourceBranchSnapshot;
  capacity?: AdminResourceCapacityView;
  lifecycle: AdminResourceLifecycle;
  lifecycleLabel: string;
  schedule?: AdminResourceScheduleSummary;
  relatedServiceCount?: number;
  staffHref?: string;
  allowedActions: AdminResourceAllowedActions;
};

export type AdminResourceFilterOptions = {
  types?: Array<{ value: string; label: string }>;
  branches?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
};

export type AdminResourceListView = {
  items: AdminResourceListItem[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  filtersApplied: boolean;
  emptyCatalog: boolean;
  filterOptions?: AdminResourceFilterOptions;
};

export type AdminResourceDetailView = {
  id: string;
  reference: string;
  name: string;
  type: AdminResourceType;
  typeLabel: string;
  description?: string;
  branch?: AdminResourceBranchSnapshot;
  capacity?: AdminResourceCapacityView;
  lifecycle: AdminResourceLifecycle;
  lifecycleLabel: string;
  customerVisible: boolean;
  customerVisibilityAllowed: boolean;
  schedule: AdminResourceScheduleSummary;
  relatedServices: Array<{ id: string; name: string }>;
  staffReference?: string;
  staffHref?: string;
  calendarHref?: string;
  scheduleManageHref?: string;
  allowedActions: AdminResourceAllowedActions;
  version?: string;
  updatedAt?: string;
  capabilities: {
    hasCapacity: boolean;
    hasBranch: boolean;
    hasSchedule: boolean;
    hasCalendar: boolean;
    canSetCustomerVisible: boolean;
  };
};

export type AdminResourceFormInput = {
  type: AdminResourceType;
  name: string;
  description?: string;
  capacity?: number;
  branchId?: string;
  scheduleMode?: AdminResourceScheduleMode;
  customerVisible?: boolean;
  version?: string;
};

export type AdminResourceImpactAction =
  | "deactivate"
  | "activate"
  | "archive"
  | "delete"
  | "change_branch";

export type AdminResourceImpactPreview = {
  action: AdminResourceImpactAction;
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  serviceMappingCount?: number;
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminResourceMutationResult = {
  reference: string;
  lifecycle: AdminResourceLifecycle;
  message?: string;
  version?: string;
  updatedAt?: string;
};

export const ADMIN_RESOURCE_LIST_LIMIT = 20;

export const ADMIN_RESOURCE_TYPES: AdminResourceType[] = [
  "staff",
  "room",
  "device",
  "desk",
  "chair",
  "bed",
  "equipment",
  "other",
];

export const ADMIN_RESOURCE_TYPE_LABELS: Record<AdminResourceType, string> = {
  staff: "کارمند",
  room: "اتاق",
  device: "دستگاه",
  desk: "میز",
  chair: "صندلی",
  bed: "تخت",
  equipment: "تجهیزات",
  other: "سایر",
  unknown: "نامشخص",
};

export const ADMIN_RESOURCE_LIFECYCLE_LABELS: Record<AdminResourceLifecycle, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
  unknown: "نامشخص",
};

export const ADMIN_RESOURCE_SCHEDULE_MODE_LABELS: Record<AdminResourceScheduleMode, string> = {
  inherit_business: "از برنامه کسب‌وکار",
  inherit_branch: "از برنامه شعبه",
  custom: "برنامه اختصاصی",
  unknown: "نامشخص",
};

export const ADMIN_RESOURCE_ACTIVE_FILTERS: AdminResourceActiveFilter[] = [
  "all",
  "active",
  "inactive",
  "archived",
];

export const ADMIN_RESOURCE_SORT_FIELDS: AdminResourceSortField[] = [
  "name",
  "type",
  "branch",
  "capacity",
  "updatedAt",
  "createdAt",
];

export const ADMIN_RESOURCE_SORT_LABELS: Record<AdminResourceSortField, string> = {
  name: "نام",
  type: "نوع",
  branch: "شعبه",
  capacity: "ظرفیت",
  updatedAt: "آخرین به‌روزرسانی",
  createdAt: "زمان ایجاد",
};

export const ADMIN_RESOURCE_ACTIVE_FILTER_LABELS: Record<AdminResourceActiveFilter, string> = {
  all: "همه وضعیت‌ها",
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
};

/** Phase 32 schedule editor is not mounted yet. */
export const ADMIN_RESOURCE_SCHEDULE_EDITOR_ENABLED = false;
