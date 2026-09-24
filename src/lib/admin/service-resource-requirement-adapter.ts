import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";
import {
  adaptAdminResourceType,
  isInternalOperationalResourceType,
} from "@/lib/admin/resource-adapter";
import {
  ADMIN_REQUIREMENT_NECESSITY_LABELS,
  ADMIN_REQUIREMENT_SELECTION_MODE_LABELS,
  ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS,
  type AdminEligibleResourcesView,
  type AdminRequirementBranchScope,
  type AdminRequirementNecessity,
  type AdminRequirementSelectionMode,
  type AdminRequirementSpecificSemantics,
  type AdminServiceResourceRequirementDraft,
  type AdminServiceResourceRequirementItem,
  type AdminServiceResourceRequirementResource,
  type AdminServiceResourceRequirementsImpactPreview,
  type AdminServiceResourceRequirementsInput,
  type AdminServiceResourceRequirementsSaveResult,
  type AdminServiceResourceRequirementsView,
} from "@/types/admin-service-resource-requirement";
import {
  ADMIN_RESOURCE_TYPE_LABELS,
  type AdminResourceType,
} from "@/types/admin-resource";

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  return raw && isSafePublicId(raw) ? raw : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function adaptNecessity(value: unknown): AdminRequirementNecessity {
  const raw = readString(value)?.toLowerCase();
  if (raw === "optional") return "optional";
  return "required";
}

function adaptSelectionMode(value: unknown): AdminRequirementSelectionMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "any_of_type" || raw === "any" || raw === "type") return "any_of_type";
  if (raw === "specific" || raw === "selected") return "specific";
  return "unknown";
}

function adaptBranchScope(value: unknown): AdminRequirementBranchScope {
  const raw = readString(value)?.toLowerCase();
  if (raw === "branch" || raw === "branch_specific") return "branch";
  if (raw === "inherited" || raw === "inherit") return "inherited";
  if (raw === "global" || raw === "all") return "global";
  return "unknown";
}

function adaptSpecificSemantics(value: unknown): AdminRequirementSpecificSemantics {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "any_one" || raw === "alternative" || raw === "or") return "any_one";
  if (raw === "all" || raw === "simultaneous" || raw === "and") return "all";
  return "unknown";
}

function adaptResourceOption(value: unknown): AdminServiceResourceRequirementResource | null {
  if (!isRecord(value)) return null;
  const id = publicId(value.id) ?? publicId(value.resourceId);
  const name = asSafeText(value.name) ?? asSafeText(value.label);
  if (!id || !name) return null;
  const type = adaptAdminResourceType(value.type ?? value.kind ?? value.resourceType);
  const lifecycle = readString(value.lifecycle ?? value.status)?.toLowerCase();
  const active =
    readBoolean(value.active) !== false &&
    lifecycle !== "inactive" &&
    lifecycle !== "archived" &&
    readBoolean(value.inactive) !== true;
  return {
    id,
    reference: readString(value.reference) ?? readString(value.resourceReference),
    name,
    type,
    active,
    branchName: asSafeText(value.branchName) ?? (isRecord(value.branch) ? asSafeText(value.branch.name) : undefined),
  };
}

function requirementKey(value: unknown, index: number): string {
  const ref = isRecord(value)
    ? readString(value.reference) ?? readString(value.id) ?? publicId(value.requirementId)
    : undefined;
  return ref ?? `draft_${index}`;
}

export function buildRequirementSummaryLine(item: AdminServiceResourceRequirementItem): string {
  const qty = item.quantity > 1 ? `${item.quantity} ` : "۱ ";
  const necessity =
    item.necessity === "optional"
      ? ADMIN_REQUIREMENT_NECESSITY_LABELS.optional
      : ADMIN_REQUIREMENT_NECESSITY_LABELS.required;
  const typeLabel = item.resourceTypeLabel;

  if (item.selectionMode === "specific" && item.selectedResources.length > 0) {
    const names = item.selectedResources.map((r) => r.name).join(" یا ");
    const semantics =
      item.specificSemantics === "all"
        ? ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS.all
        : item.specificSemantics === "any_one"
          ? ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS.any_one
          : undefined;
    const semanticsSuffix = semantics ? ` (${semantics})` : "";
    return `${qty}${necessity} ${typeLabel} — ${names}${semanticsSuffix}`;
  }

  if (item.selectionMode === "any_of_type") {
    const role = item.staffRole ? ` (${item.staffRole})` : "";
    return `${qty}${necessity} ${typeLabel} — ${ADMIN_REQUIREMENT_SELECTION_MODE_LABELS.any_of_type}${role}`;
  }

  if (item.resourceType === "staff" && item.providerSelectable) {
    return `${qty}${necessity} ${typeLabel} — قابل انتخاب توسط مشتری`;
  }

  return `${qty}${necessity} ${typeLabel}`;
}

export function buildSummaryLineFromDraft(draft: AdminServiceResourceRequirementDraft): string {
  const resourceNames = draft.selectedResourceNames ?? {};
  const item: AdminServiceResourceRequirementItem = {
    key: draft.key,
    resourceType: draft.resourceType,
    resourceTypeLabel: ADMIN_RESOURCE_TYPE_LABELS[draft.resourceType],
    quantity: draft.quantity,
    necessity: draft.necessity,
    selectionMode: draft.selectionMode,
    specificSemantics: "unknown",
    selectedResources: draft.selectedResourceIds.map((id) => ({
      id,
      name: resourceNames[id] ?? id,
      type: draft.resourceType,
      active: true,
    })),
    branchScope: draft.branchScope,
    branchId: draft.branchId,
    staffRole: draft.staffRole,
    providerSelectable: draft.providerSelectable,
  };
  return buildRequirementSummaryLine(item);
}

export function buildRequirementsSummary(
  requirements: AdminServiceResourceRequirementItem[],
): string[] {
  return requirements.map((item) => item.summaryLine ?? buildRequirementSummaryLine(item));
}

export function detectDuplicateTypeWarnings(
  requirements: AdminServiceResourceRequirementItem[],
): string[] {
  const counts = new Map<string, number>();
  for (const req of requirements) {
    const key = `${req.resourceType}:${req.branchScope}:${req.branchId ?? "all"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const warnings: string[] = [];
  for (const [key, count] of counts) {
    if (count > 1) {
      const [type] = key.split(":");
      const label = ADMIN_RESOURCE_TYPE_LABELS[type as AdminResourceType] ?? type;
      warnings.push(
        `چند نیازمندی برای «${label}» در یک محدوده ثبت شده — اعتبار نهایی با Backend است.`,
      );
    }
  }
  return warnings;
}

function adaptRequirementItem(value: unknown, index: number): AdminServiceResourceRequirementItem | null {
  if (!isRecord(value)) return null;
  const resourceType = adaptAdminResourceType(value.resourceType ?? value.type ?? value.kind);
  const quantity = readNumber(value.quantity) ?? 1;
  const necessity = adaptNecessity(value.necessity ?? value.required);
  const selectionMode = adaptSelectionMode(value.selectionMode ?? value.selection);
  const branchScope = adaptBranchScope(value.branchScope ?? value.scope);
  const specificSemantics = adaptSpecificSemantics(
    value.specificSemantics ?? value.selectionSemantics,
  );

  const selectedResources = asList(value.selectedResources ?? value.resources ?? value.resourceIds, [
    "items",
  ])
    .map((entry) => {
      if (typeof entry === "string") {
        return adaptResourceOption({ id: entry, name: entry, type: resourceType, active: true });
      }
      return adaptResourceOption(entry);
    })
    .filter((item): item is AdminServiceResourceRequirementResource => Boolean(item));

  const inactiveSelection = selectedResources.some((r) => !r.active);

  const item: AdminServiceResourceRequirementItem = {
    key: requirementKey(value, index),
    reference: readString(value.reference) ?? readString(value.id),
    resourceType,
    resourceTypeLabel: asSafeText(value.typeLabel) ?? ADMIN_RESOURCE_TYPE_LABELS[resourceType],
    quantity,
    quantityMin: readNumber(value.quantityMin ?? value.minQuantity) ?? 1,
    quantityMax: readNumber(value.quantityMax ?? value.maxQuantity),
    necessity,
    selectionMode,
    specificSemantics,
    selectedResources,
    branchScope,
    branchId: publicId(value.branchId) ?? (isRecord(value.branch) ? publicId(value.branch.id) : undefined),
    branchName: asSafeText(value.branchName) ?? (isRecord(value.branch) ? asSafeText(value.branch.name) : undefined),
    staffRole: asSafeText(value.staffRole) ?? asSafeText(value.role),
    providerSelectable: readBoolean(value.providerSelectable) === true,
    sortOrder: readNumber(value.sortOrder ?? value.order),
    inactiveSelection,
  };
  item.summaryLine = buildRequirementSummaryLine(item);
  return item;
}

export function adaptAdminServiceResourceRequirements(
  serviceReference: string,
  payload: unknown,
): AdminServiceResourceRequirementsView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;

  const requirements = asList(root, ["requirements", "items"])
    .map((item, index) => adaptRequirementItem(item, index))
    .filter((item): item is AdminServiceResourceRequirementItem => Boolean(item))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const capsSource = isRecord(root.capabilities) ? root.capabilities : root;
  const view: AdminServiceResourceRequirementsView = {
    serviceReference:
      readString(root.serviceReference) ?? readString(root.reference) ?? serviceReference,
    serviceName: asSafeText(root.serviceName) ?? asSafeText(root.name),
    serviceId: publicId(root.serviceId) ?? publicId(root.id),
    requirements,
    summaryLines: buildRequirementsSummary(requirements),
    duplicateTypeWarnings: detectDuplicateTypeWarnings(requirements),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    emptyMapping: requirements.length === 0,
    capabilities: {
      canEdit: readBoolean(capsSource.canEdit) !== false,
      canReorder: readBoolean(capsSource.canReorder) === true,
      hasBranchScope: readBoolean(capsSource.hasBranchScope) === true,
      hasStaffRole: readBoolean(capsSource.hasStaffRole) !== false,
      hasProviderSelectable: readBoolean(capsSource.hasProviderSelectable) !== false,
      atomicSave: readBoolean(capsSource.atomicSave) !== false,
    },
  };
  return view;
}

export function adaptEligibleResources(payload: unknown): AdminEligibleResourcesView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(source, ["items", "resources"])
    .map((item) => adaptResourceOption(item))
    .filter((item): item is AdminServiceResourceRequirementResource => Boolean(item))
    .filter((item) => item.active);
  return {
    items,
    selectionSemantics: adaptSpecificSemantics(source.selectionSemantics ?? source.specificSemantics),
    semanticsLabel: asSafeText(source.semanticsLabel) ?? asSafeText(source.help),
  };
}

export function adaptServiceResourceRequirementsImpactPreview(
  payload: unknown,
): AdminServiceResourceRequirementsImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const effects = asList(root.effects ?? root.warnings, ["items"])
    .map((item) =>
      typeof item === "string"
        ? asSafeText(item)
        : isRecord(item)
          ? asSafeText(item.message) ?? asSafeText(item.label)
          : undefined,
    )
    .filter((item): item is string => Boolean(item));
  return {
    title: asSafeText(root.title) ?? "تأیید ذخیره نیازمندی‌ها",
    summary:
      asSafeText(root.summary) ??
      asSafeText(root.message) ??
      "این تغییر ممکن است روی دسترس‌پذیری و نوبت‌های آینده اثر بگذارد.",
    effects,
    futureAppointmentCount: readNumber(root.futureAppointmentCount),
    availabilityAffected: readBoolean(root.availabilityAffected) === true,
    branchWarnings: asList(root.branchWarnings, ["items"])
      .map((item) => (typeof item === "string" ? asSafeText(item) : undefined))
      .filter((item): item is string => Boolean(item)),
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason),
  };
}

export function adaptServiceResourceRequirementsSaveResult(
  payload: unknown,
): AdminServiceResourceRequirementsSaveResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const serviceReference = readString(root.serviceReference) ?? readString(root.reference);
  if (!serviceReference) return null;
  const partialFailures = asList(root.partialFailures ?? root.errors, ["items"])
    .map((item) => {
      if (!isRecord(item)) return null;
      const key = readString(item.key) ?? readString(item.reference) ?? readString(item.id);
      const message = asSafeText(item.message);
      if (!key || !message) return null;
      return { key, message };
    })
    .filter((item): item is { key: string; message: string } => Boolean(item));
  return {
    serviceReference,
    version: readString(root.version),
    updatedAt: readString(root.updatedAt),
    partialFailures: partialFailures.length ? partialFailures : undefined,
  };
}

export function draftsFromView(view: AdminServiceResourceRequirementsView): AdminServiceResourceRequirementDraft[] {
  return view.requirements.map((item) => ({
    key: item.key,
    reference: item.reference,
    resourceType: item.resourceType,
    quantity: item.quantity,
    necessity: item.necessity,
    selectionMode: item.selectionMode === "unknown" ? "any_of_type" : item.selectionMode,
    selectedResourceIds: item.selectedResources.map((r) => r.id),
    selectedResourceNames: Object.fromEntries(
      item.selectedResources.map((resource) => [resource.id, resource.name]),
    ),
    branchScope: item.branchScope === "unknown" ? "global" : item.branchScope,
    branchId: item.branchId,
    staffRole: item.staffRole,
    providerSelectable: item.providerSelectable,
    sortOrder: item.sortOrder,
  }));
}

export function inputFromDrafts(
  drafts: AdminServiceResourceRequirementDraft[],
  version?: string,
): AdminServiceResourceRequirementsInput {
  return {
    requirements: drafts.map((draft, index) => ({
      ...draft,
      sortOrder: draft.sortOrder ?? index + 1,
    })),
    version,
  };
}

export function sanitizeRequirementsPayload(
  input: AdminServiceResourceRequirementsInput,
): Record<string, unknown> {
  return {
    version: input.version,
    requirements: input.requirements.map((req) => ({
      reference: req.reference,
      resourceType: req.resourceType === "unknown" ? undefined : req.resourceType,
      quantity: req.quantity,
      necessity: req.necessity,
      selectionMode: req.selectionMode === "unknown" ? undefined : req.selectionMode,
      resourceIds:
        req.selectionMode === "specific" && req.selectedResourceIds.length
          ? req.selectedResourceIds
          : undefined,
      branchScope: req.branchScope === "unknown" ? undefined : req.branchScope,
      branchId: req.branchScope === "branch" ? req.branchId : undefined,
      staffRole: req.resourceType === "staff" ? req.staffRole : undefined,
      providerSelectable:
        req.resourceType === "staff" && req.providerSelectable ? true : undefined,
      sortOrder: req.sortOrder,
    })),
  };
}

export type RequirementRowErrors = Partial<
  Record<
    | "resourceType"
    | "quantity"
    | "necessity"
    | "selectionMode"
    | "selectedResourceIds"
    | "branchId"
    | "staffRole",
    string
  >
>;

export function validateRequirementDraft(
  draft: AdminServiceResourceRequirementDraft,
  options: { minQuantity?: number; maxQuantity?: number; hasBranchScope?: boolean },
): RequirementRowErrors {
  const errors: RequirementRowErrors = {};
  if (!draft.resourceType || draft.resourceType === "unknown") {
    errors.resourceType = "نوع منبع را انتخاب کنید.";
  }
  if (!Number.isInteger(draft.quantity) || draft.quantity < (options.minQuantity ?? 1)) {
    errors.quantity = `تعداد باید عدد صحیح ≥ ${options.minQuantity ?? 1} باشد.`;
  }
  if (options.maxQuantity !== undefined && draft.quantity > options.maxQuantity) {
    errors.quantity = `حداکثر تعداد ${options.maxQuantity} است.`;
  }
  if (draft.selectionMode === "specific" && draft.selectedResourceIds.length === 0) {
    errors.selectedResourceIds = "حداقل یک منبع مشخص انتخاب کنید.";
  }
  if (options.hasBranchScope && draft.branchScope === "branch" && !draft.branchId) {
    errors.branchId = "شعبه را انتخاب کنید.";
  }
  return errors;
}

export function validateAllRequirementDrafts(
  drafts: AdminServiceResourceRequirementDraft[],
  options: { hasBranchScope?: boolean } = {},
): Record<string, RequirementRowErrors> {
  const map: Record<string, RequirementRowErrors> = {};
  for (const draft of drafts) {
    const errors = validateRequirementDraft(draft, options);
    if (Object.keys(errors).length) map[draft.key] = errors;
  }
  return map;
}

export function isServiceResourceRequirementsConflict(error: {
  status?: number;
  code?: string;
}): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("STALE");
}

export function serviceResourceRequirementsConflictMessage(): string {
  return "نیازمندی‌های این خدمت توسط فرد دیگری به‌روزرسانی شده است. لطفاً آخرین نسخه را بررسی کنید.";
}

/** Internal operational requirements must never be exposed in customer UI payloads. */
export function isAdminOnlyRequirementSummary(summary: string): boolean {
  return summary.length > 0;
}

export function requirementInvolvesInternalResources(item: AdminServiceResourceRequirementItem): boolean {
  if (item.resourceType === "staff" && item.providerSelectable) return false;
  return isInternalOperationalResourceType(item.resourceType) || item.resourceType === "staff";
}
