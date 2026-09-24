export type AdminStaffLifecycle = "active" | "inactive" | "archived" | "unknown";

export type AdminStaffScheduleMode =
  | "inherit_business"
  | "inherit_branch"
  | "custom"
  | "unknown";

export type AdminStaffActiveFilter = "all" | "active" | "inactive" | "archived";

export type AdminStaffVisibilityFilter = "all" | "visible" | "hidden";

export type AdminStaffBookableFilter = "all" | "bookable" | "not_bookable";

export type AdminStaffSortField =
  | "name"
  | "jobTitle"
  | "specialty"
  | "branch"
  | "updatedAt"
  | "createdAt";

export type AdminStaffSortDirection = "asc" | "desc";

export type AdminStaffAllowedActions = {
  view?: boolean;
  edit?: boolean;
  deactivate?: boolean;
  activate?: boolean;
  archive?: boolean;
  delete?: boolean;
  viewCalendar?: boolean;
  viewPerformance?: boolean;
  manageSchedule?: boolean;
  viewPrivateContact?: boolean;
  uploadAvatar?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminStaffListFilters = {
  q?: string;
  active: AdminStaffActiveFilter;
  branchId?: string;
  serviceId?: string;
  jobTitle?: string;
  specialty?: string;
  customerVisible: AdminStaffVisibilityFilter;
  bookable: AdminStaffBookableFilter;
  sort: AdminStaffSortField;
  direction: AdminStaffSortDirection;
  page: number;
};

export type AdminStaffAvatarView = {
  imageUrl?: string;
  initials?: string;
};

export type AdminStaffBranchAssignment = {
  id: string;
  name: string;
  primary?: boolean;
};

export type AdminStaffServiceAssignment = {
  id: string;
  name: string;
};

export type AdminStaffScheduleSummary = {
  mode: AdminStaffScheduleMode;
  sourceLabel?: string;
  summary?: string;
  workingHoursLabel?: string;
  breaksLabel?: string;
  leaveLabel?: string;
  blockTimeLabel?: string;
};

export type AdminStaffPrivateContact = {
  phone?: string;
  email?: string;
  masked?: boolean;
};

export type AdminStaffListItem = {
  id: string;
  reference: string;
  name: string;
  jobTitle?: string;
  specialty?: string;
  avatar?: AdminStaffAvatarView;
  branches: AdminStaffBranchAssignment[];
  services: AdminStaffServiceAssignment[];
  lifecycle: AdminStaffLifecycle;
  lifecycleLabel: string;
  customerVisible: boolean;
  bookable: boolean;
  schedule?: AdminStaffScheduleSummary;
  resourceHref?: string;
  allowedActions: AdminStaffAllowedActions;
};

export type AdminStaffFilterOptions = {
  branches?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
  jobTitles?: Array<{ value: string; label: string }>;
  specialties?: Array<{ value: string; label: string }>;
};

export type AdminStaffListView = {
  items: AdminStaffListItem[];
  page: number;
  pageCount?: number;
  totalCount?: number;
  hasMore: boolean;
  filtersApplied: boolean;
  emptyCatalog: boolean;
  filterOptions?: AdminStaffFilterOptions;
};

export type AdminStaffDetailView = {
  id: string;
  reference: string;
  firstName?: string;
  lastName?: string;
  name: string;
  jobTitle?: string;
  specialty?: string;
  publicDescription?: string;
  avatar?: AdminStaffAvatarView;
  privateContact?: AdminStaffPrivateContact;
  branches: AdminStaffBranchAssignment[];
  services: AdminStaffServiceAssignment[];
  lifecycle: AdminStaffLifecycle;
  lifecycleLabel: string;
  customerVisible: boolean;
  bookable: boolean;
  schedule: AdminStaffScheduleSummary;
  resourceReference?: string;
  resourceHref?: string;
  adminUserReference?: string;
  adminUserHref?: string;
  calendarHref?: string;
  performanceHref?: string;
  allowedActions: AdminStaffAllowedActions;
  version?: string;
  updatedAt?: string;
  capabilities: {
    hasAvatarUpload: boolean;
    hasPrivateContact: boolean;
    hasPerformance: boolean;
    hasSchedule: boolean;
    hasCalendar: boolean;
    hasMultiBranch: boolean;
    hasServiceAssignment: boolean;
  };
};

export type AdminStaffFormInput = {
  firstName?: string;
  lastName?: string;
  name: string;
  jobTitle?: string;
  specialty?: string;
  publicDescription?: string;
  phone?: string;
  email?: string;
  branchIds: string[];
  primaryBranchId?: string;
  serviceIds: string[];
  customerVisible: boolean;
  bookable: boolean;
  scheduleMode?: AdminStaffScheduleMode;
  version?: string;
};

export type AdminStaffImpactAction =
  | "deactivate"
  | "activate"
  | "archive"
  | "delete"
  | "remove_branch"
  | "remove_service";

export type AdminStaffImpactPreview = {
  action: AdminStaffImpactAction;
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
  contextId?: string;
};

export type AdminStaffMutationResult = {
  reference: string;
  lifecycle: AdminStaffLifecycle;
  message?: string;
  version?: string;
  updatedAt?: string;
};

export type AdminStaffPerformanceView = {
  reference: string;
  periodLabel?: string;
  appointmentCount?: number;
  completedCount?: number;
  cancelledCount?: number;
  noShowCount?: number;
  utilizationLabel?: string;
  revenueLabel?: string;
  metrics: Array<{ label: string; value: string }>;
};

export const ADMIN_STAFF_LIST_LIMIT = 20;

export const ADMIN_STAFF_LIFECYCLE_LABELS: Record<AdminStaffLifecycle, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
  unknown: "نامشخص",
};

export const ADMIN_STAFF_SCHEDULE_MODE_LABELS: Record<AdminStaffScheduleMode, string> = {
  inherit_business: "از برنامه کسب‌وکار",
  inherit_branch: "از برنامه شعبه",
  custom: "برنامه اختصاصی",
  unknown: "نامشخص",
};

export const ADMIN_STAFF_ACTIVE_FILTERS: AdminStaffActiveFilter[] = [
  "all",
  "active",
  "inactive",
  "archived",
];

export const ADMIN_STAFF_VISIBILITY_FILTERS: AdminStaffVisibilityFilter[] = [
  "all",
  "visible",
  "hidden",
];

export const ADMIN_STAFF_BOOKABLE_FILTERS: AdminStaffBookableFilter[] = [
  "all",
  "bookable",
  "not_bookable",
];

export const ADMIN_STAFF_SORT_FIELDS: AdminStaffSortField[] = [
  "name",
  "jobTitle",
  "specialty",
  "branch",
  "updatedAt",
  "createdAt",
];

export const ADMIN_STAFF_SORT_LABELS: Record<AdminStaffSortField, string> = {
  name: "نام",
  jobTitle: "سمت",
  specialty: "تخصص",
  branch: "شعبه",
  updatedAt: "آخرین به‌روزرسانی",
  createdAt: "زمان ایجاد",
};

export const ADMIN_STAFF_ACTIVE_FILTER_LABELS: Record<AdminStaffActiveFilter, string> = {
  all: "همه وضعیت‌ها",
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
};

export const ADMIN_STAFF_VISIBILITY_FILTER_LABELS: Record<
  AdminStaffVisibilityFilter,
  string
> = {
  all: "همه",
  visible: "نمایش برای مشتری",
  hidden: "مخفی از مشتری",
};

export const ADMIN_STAFF_BOOKABLE_FILTER_LABELS: Record<AdminStaffBookableFilter, string> =
  {
    all: "همه",
    bookable: "قابل رزرو",
    not_bookable: "غیرقابل رزرو",
  };

/** Phase 32 schedule editor is not mounted yet. */
export const ADMIN_STAFF_SCHEDULE_EDITOR_ENABLED = false;
