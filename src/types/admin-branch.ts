export type AdminBranchLifecycle = "active" | "inactive" | "archived" | "unknown";

export type AdminBranchScheduleMode = "inherit_business" | "custom" | "unknown";

export type AdminBranchActiveFilter = "all" | "active" | "inactive" | "archived";

export type AdminBranchSortField = "name" | "status" | "updatedAt" | "createdAt";
export type AdminBranchSortDirection = "asc" | "desc";

export type AdminBranchLocationView = {
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  directionsUrl?: string;
  label?: string;
};

export type AdminBranchScheduleSummary = {
  mode: AdminBranchScheduleMode;
  sourceLabel?: string;
  summary?: string;
  workingHoursLabel?: string;
  holidaysLabel?: string;
};

export type AdminBranchStaffAssignment = {
  id: string;
  reference: string;
  name: string;
  jobTitle?: string;
  primary?: boolean;
  scheduleCompatible?: boolean;
  warning?: string;
};

export type AdminBranchResourceAssignment = {
  id: string;
  reference: string;
  name: string;
  type?: string;
  typeLabel?: string;
};

export type AdminBranchServiceAssignment = {
  id: string;
  reference: string;
  name: string;
  lifecycle?: string;
  lifecycleLabel?: string;
  feasible?: boolean;
  warning?: string;
};

export type AdminBranchOperationalWarning = {
  id: string;
  message: string;
  severity?: "info" | "warning" | "danger";
};

export type AdminBranchAllowedActions = {
  view?: boolean;
  edit?: boolean;
  create?: boolean;
  deactivate?: boolean;
  activate?: boolean;
  archive?: boolean;
  delete?: boolean;
  manageSchedule?: boolean;
  manageHolidays?: boolean;
  assignStaff?: boolean;
  assignResources?: boolean;
  assignServices?: boolean;
  viewCalendar?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminBranchCapabilities = {
  supportsTimezoneEdit?: boolean;
  supportsLocationCoordinates?: boolean;
  supportsMapUrl?: boolean;
  supportsImpactPreview?: boolean;
  supportsServiceFeasibilityCheck?: boolean;
};

export type AdminBranchListFilters = {
  q?: string;
  active: AdminBranchActiveFilter;
  sort: AdminBranchSortField;
  direction: AdminBranchSortDirection;
  page: number;
};

export type AdminBranchListItem = {
  id: string;
  reference: string;
  name: string;
  publicTitle?: string;
  address?: string;
  phone?: string;
  lifecycle: AdminBranchLifecycle;
  lifecycleLabel: string;
  schedule?: AdminBranchScheduleSummary;
  staffCount?: number;
  resourceCount?: number;
  serviceCount?: number;
  detailHref: string;
  editHref: string;
  scheduleHref?: string;
  calendarHref?: string;
};

export type AdminBranchListView = {
  items: AdminBranchListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  emptyCatalog?: boolean;
  filtersApplied?: boolean;
};

export type AdminBranchDetailView = {
  id: string;
  reference: string;
  name: string;
  publicTitle?: string;
  address?: string;
  phone?: string;
  location?: AdminBranchLocationView;
  timezone?: string;
  schedule: AdminBranchScheduleSummary;
  lifecycle: AdminBranchLifecycle;
  lifecycleLabel: string;
  staff: AdminBranchStaffAssignment[];
  resources: AdminBranchResourceAssignment[];
  services: AdminBranchServiceAssignment[];
  holidaysSummary?: string;
  operationalWarnings: AdminBranchOperationalWarning[];
  version?: string;
  updatedAt?: string;
  allowedActions: AdminBranchAllowedActions;
  capabilities: AdminBranchCapabilities;
  scheduleHref?: string;
  calendarHref?: string;
  holidaysHref?: string;
  editHref: string;
};

export type AdminBranchFormInput = {
  name: string;
  publicTitle?: string;
  address?: string;
  phone?: string;
  location?: AdminBranchLocationView;
  timezone?: string;
  scheduleMode: AdminBranchScheduleMode;
  version?: string;
};

export type AdminBranchImpactAction =
  | "activate"
  | "deactivate"
  | "archive"
  | "delete"
  | "assign_staff"
  | "remove_staff"
  | "assign_resource"
  | "transfer_resource"
  | "remove_resource"
  | "assign_service"
  | "remove_service";

export type AdminBranchImpactPreview = {
  action: AdminBranchImpactAction;
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  waitingListAffected?: boolean;
  availabilityAffected?: boolean;
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
  contextId?: string;
  contextLabel?: string;
};

export type AdminBranchMutationResult = {
  reference: string;
  version?: string;
  updatedAt?: string;
};

export type AdminBranchFormErrors = Partial<Record<keyof AdminBranchFormInput, string>>;

export type AdminBranchFormImpactField =
  | "name"
  | "address"
  | "phone"
  | "location"
  | "timezone"
  | "scheduleMode"
  | "status";

export const ADMIN_BRANCH_LIST_LIMIT = 20;

export const ADMIN_BRANCH_ACTIVE_FILTERS = ["all", "active", "inactive", "archived"] as const;

export const ADMIN_BRANCH_SORT_FIELDS: AdminBranchSortField[] = [
  "name",
  "status",
  "updatedAt",
  "createdAt",
];

export const ADMIN_BRANCH_LIFECYCLE_LABELS: Record<
  Exclude<AdminBranchLifecycle, "unknown">,
  string
> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی‌شده",
};

export const ADMIN_BRANCH_SCHEDULE_MODE_LABELS: Record<
  Exclude<AdminBranchScheduleMode, "unknown">,
  string
> = {
  inherit_business: "از ساعات کسب‌وکار",
  custom: "سفارشی",
};

export const ADMIN_BRANCH_MANAGEMENT_ENABLED = true;
