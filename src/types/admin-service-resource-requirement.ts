import type { AdminResourceType } from "@/types/admin-resource";

/** Whether absence blocks booking. Backend decides operational validity. */
export type AdminRequirementNecessity = "required" | "optional";

/** How the backend picks resources for this requirement. */
export type AdminRequirementSelectionMode = "any_of_type" | "specific" | "unknown";

/** Branch applicability of a requirement. */
export type AdminRequirementBranchScope = "global" | "branch" | "inherited" | "unknown";

/**
 * When selectionMode is specific, backend defines whether selected items are
 * alternatives (any_one) or all required simultaneously (all).
 * Do not infer when unknown.
 */
export type AdminRequirementSpecificSemantics = "any_one" | "all" | "unknown";

export type AdminServiceResourceRequirementResource = {
  id: string;
  reference?: string;
  name: string;
  type: AdminResourceType;
  active: boolean;
  branchName?: string;
};

export type AdminServiceResourceRequirementItem = {
  /** Client draft id or backend reference */
  key: string;
  reference?: string;
  resourceType: AdminResourceType;
  resourceTypeLabel: string;
  quantity: number;
  quantityMin?: number;
  quantityMax?: number;
  necessity: AdminRequirementNecessity;
  selectionMode: AdminRequirementSelectionMode;
  specificSemantics: AdminRequirementSpecificSemantics;
  selectedResources: AdminServiceResourceRequirementResource[];
  branchScope: AdminRequirementBranchScope;
  branchId?: string;
  branchName?: string;
  staffRole?: string;
  /** Customer may select this human provider when true and backend allows. */
  providerSelectable?: boolean;
  sortOrder?: number;
  summaryLine?: string;
  inactiveSelection?: boolean;
};

export type AdminServiceResourceRequirementsCapabilities = {
  canEdit: boolean;
  canReorder: boolean;
  hasBranchScope: boolean;
  hasStaffRole: boolean;
  hasProviderSelectable: boolean;
  atomicSave: boolean;
};

export type AdminServiceResourceRequirementsView = {
  serviceReference: string;
  serviceName?: string;
  serviceId?: string;
  requirements: AdminServiceResourceRequirementItem[];
  summaryLines: string[];
  duplicateTypeWarnings: string[];
  version?: string;
  updatedAt?: string;
  emptyMapping: boolean;
  capabilities: AdminServiceResourceRequirementsCapabilities;
};

export type AdminServiceResourceRequirementDraft = {
  key: string;
  reference?: string;
  resourceType: AdminResourceType;
  quantity: number;
  necessity: AdminRequirementNecessity;
  selectionMode: AdminRequirementSelectionMode;
  selectedResourceIds: string[];
  /** Preserved labels for summary preview when eligible list is not loaded. */
  selectedResourceNames?: Record<string, string>;
  branchScope: AdminRequirementBranchScope;
  branchId?: string;
  staffRole?: string;
  providerSelectable?: boolean;
  sortOrder?: number;
};

export type AdminServiceResourceRequirementsInput = {
  requirements: AdminServiceResourceRequirementDraft[];
  version?: string;
};

export type AdminServiceResourceRequirementsImpactPreview = {
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  availabilityAffected?: boolean;
  branchWarnings?: string[];
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminServiceResourceRequirementsSaveResult = {
  serviceReference: string;
  version?: string;
  updatedAt?: string;
  partialFailures?: Array<{ key: string; message: string }>;
};

export type AdminEligibleResourcesView = {
  items: AdminServiceResourceRequirementResource[];
  selectionSemantics?: AdminRequirementSpecificSemantics;
  semanticsLabel?: string;
};

export const ADMIN_REQUIREMENT_NECESSITY_LABELS: Record<AdminRequirementNecessity, string> = {
  required: "الزامی",
  optional: "اختیاری",
};

export const ADMIN_REQUIREMENT_SELECTION_MODE_LABELS: Record<
  Exclude<AdminRequirementSelectionMode, "unknown">,
  string
> = {
  any_of_type: "هر منبع واجد شرایط از این نوع",
  specific: "منابع مشخص",
};

export const ADMIN_REQUIREMENT_BRANCH_SCOPE_LABELS: Record<
  Exclude<AdminRequirementBranchScope, "unknown">,
  string
> = {
  global: "همه شعب",
  branch: "شعبه مشخص",
  inherited: "از تنظیمات والد",
};

export const ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS: Record<
  Exclude<AdminRequirementSpecificSemantics, "unknown">,
  string
> = {
  any_one: "یکی از موارد انتخاب‌شده (جایگزین)",
  all: "همه موارد انتخاب‌شده هم‌زمان",
};

export const ADMIN_SERVICE_RESOURCE_REQUIREMENT_TYPES: AdminResourceType[] = [
  "staff",
  "room",
  "device",
  "desk",
  "chair",
  "bed",
  "equipment",
  "other",
];
