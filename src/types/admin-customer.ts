import type { StatusKey } from "@/lib/status/status-map";
import type { AdminManualBookingCreateCustomerInput } from "@/types/admin-manual-booking";

export type AdminCustomerLifecycle = "active" | "inactive" | "blocked" | "unknown";

export type AdminCustomerActiveFilter = "all" | "active" | "inactive" | "blocked";

export type AdminCustomerUpcomingFilter = "all" | "has_upcoming" | "none";

export type AdminCustomerSortField =
  | "name"
  | "lastVisit"
  | "nextAppointment"
  | "totalVisits"
  | "createdAt"
  | "updatedAt";

export type AdminCustomerSortDirection = "asc" | "desc";

export type AdminCustomerContactView = {
  phone?: string;
  phoneMasked?: string;
  email?: string;
  emailMasked?: string;
  canViewFullPhone?: boolean;
  canViewFullEmail?: boolean;
  canCopyContact?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
};

export type AdminCustomerMetricsView = {
  totalVisits?: number | null;
  cancellationCount?: number | null;
  noShowCount?: number | null;
  periodLabel?: string;
  unavailable?: boolean;
};

export type AdminCustomerUpcomingAppointmentView = {
  id: string;
  reference: string;
  startsAt: string;
  timezone?: string;
  serviceName?: string;
  branchName?: string;
  status: StatusKey;
  detailHref: string;
};

export type AdminCustomerTagView = {
  id: string;
  name: string;
  color?: string;
  colorLabel?: string;
};

export type AdminCustomerNoteView = {
  id: string;
  body: string;
  authorLabel?: string;
  createdAt?: string;
  createdAtLabel?: string;
};

export type AdminCustomerDuplicateMatch = {
  id: string;
  reference: string;
  displayName: string;
  detailHref: string;
  phoneMasked?: string;
};

export type AdminCustomerAllowedActions = {
  view?: boolean;
  edit?: boolean;
  create?: boolean;
  viewFullPhone?: boolean;
  viewFullEmail?: boolean;
  copyContact?: boolean;
  editContact?: boolean;
  editContactOverride?: boolean;
  manageNotes?: boolean;
  manageTags?: boolean;
  createTag?: boolean;
  viewPayments?: boolean;
  block?: boolean;
  unblock?: boolean;
  deactivate?: boolean;
  activate?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminCustomerCapabilities = {
  supportsNotesAppend?: boolean;
  supportsNotesEdit?: boolean;
  supportsTagCreate?: boolean;
  supportsImpactPreview?: boolean;
  supportsVerifiedContactOverride?: boolean;
};

export type AdminCustomerListFilters = {
  q?: string;
  active: AdminCustomerActiveFilter;
  upcoming: AdminCustomerUpcomingFilter;
  lastVisitFrom?: string;
  lastVisitTo?: string;
  serviceId?: string;
  branchId?: string;
  tagId?: string;
  sort: AdminCustomerSortField;
  direction: AdminCustomerSortDirection;
  page: number;
};

export type AdminCustomerListItem = {
  id: string;
  reference: string;
  displayName: string;
  lifecycle: AdminCustomerLifecycle;
  lifecycleLabel: string;
  contact: AdminCustomerContactView;
  nextAppointmentLabel?: string;
  lastVisitLabel?: string;
  metrics: AdminCustomerMetricsView;
  tags: AdminCustomerTagView[];
  detailHref: string;
  editHref: string;
};

export type AdminCustomerListView = {
  items: AdminCustomerListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  emptyCatalog?: boolean;
  filtersApplied?: boolean;
  filterOptions?: AdminCustomerFilterOptions;
};

export type AdminCustomerFilterOptions = {
  services?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  tags?: { id: string; name: string }[];
};

export type AdminCustomerDetailView = {
  id: string;
  reference: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  lifecycle: AdminCustomerLifecycle;
  lifecycleLabel: string;
  blockedReason?: string;
  contact: AdminCustomerContactView;
  metrics: AdminCustomerMetricsView;
  upcomingAppointment?: AdminCustomerUpcomingAppointmentView | null;
  tags: AdminCustomerTagView[];
  notes: AdminCustomerNoteView[];
  notesModel?: "append" | "single" | "unknown";
  duplicateMatches: AdminCustomerDuplicateMatch[];
  version?: string;
  updatedAt?: string;
  allowedActions: AdminCustomerAllowedActions;
  capabilities: AdminCustomerCapabilities;
  editHref: string;
  tagCatalog?: AdminCustomerTagView[];
};

export type AdminCustomerFormInput = AdminManualBookingCreateCustomerInput & {
  version?: string;
};

export type AdminCustomerFormErrors = Partial<Record<keyof AdminCustomerFormInput, string>>;

export type AdminCustomerImpactAction = "block" | "unblock" | "deactivate" | "activate";

export type AdminCustomerImpactPreview = {
  action: AdminCustomerImpactAction;
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  waitingListAffected?: boolean;
  pendingPaymentCount?: number;
  requiresConfirmation: boolean;
  requiresReason?: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminCustomerMutationResult = {
  reference: string;
  version?: string;
  updatedAt?: string;
};

export type AdminCustomerNoteInput = {
  body: string;
  version?: string;
};

export const ADMIN_CUSTOMER_LIST_LIMIT = 20;
export const ADMIN_CUSTOMER_SEARCH_MIN_LENGTH = 2;

export const ADMIN_CUSTOMER_ACTIVE_FILTERS = ["all", "active", "inactive", "blocked"] as const;

export const ADMIN_CUSTOMER_UPCOMING_FILTERS = ["all", "has_upcoming", "none"] as const;

export const ADMIN_CUSTOMER_SORT_FIELDS: AdminCustomerSortField[] = [
  "name",
  "lastVisit",
  "nextAppointment",
  "totalVisits",
  "createdAt",
  "updatedAt",
];

export const ADMIN_CUSTOMER_LIFECYCLE_LABELS: Record<
  Exclude<AdminCustomerLifecycle, "unknown">,
  string
> = {
  active: "فعال",
  inactive: "غیرفعال",
  blocked: "مسدود",
};

export const ADMIN_CUSTOMER_MANAGEMENT_ENABLED = true;
