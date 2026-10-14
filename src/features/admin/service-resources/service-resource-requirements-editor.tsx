"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { ServiceResourceRequirementRow } from "@/features/admin/service-resources/service-resource-requirement-row";
import { ServiceResourceRequirementsSummary } from "@/features/admin/service-resources/service-resource-requirements-summary";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  buildSummaryLineFromDraft,
  detectDuplicateTypeWarnings,
  draftsFromView,
  inputFromDrafts,
  isServiceResourceRequirementsConflict,
  serviceResourceRequirementsConflictMessage,
  validateAllRequirementDrafts,
} from "@/lib/admin/service-resource-requirement-adapter";
import { invalidateAfterServiceResourceRequirementsMutation } from "@/lib/admin/service-resource-requirement-cache";
import { adminResourceTypesQueryOptions } from "@/lib/api/admin-resources";
import { saveAdminServiceResourceRequirements } from "@/lib/api/admin-service-resources";
import {
  isForbiddenError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBranches } from "@/lib/api/public";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminServiceResourceRequirementDraft,
  AdminServiceResourceRequirementsImpactPreview,
  AdminServiceResourceRequirementsView,
} from "@/types/admin-service-resource-requirement";

/** The Backend has no preview route; this states what its full-replace PUT does. */
const SAVE_CONFIRMATION: AdminServiceResourceRequirementsImpactPreview = {
  title: "تأیید ذخیره نیازمندی‌ها",
  summary:
    "همه نیازمندی‌های منبع این خدمت با این فهرست جایگزین می‌شوند و دسترس‌پذیری نوبت‌های بعدی بر اساس آن محاسبه می‌شود.",
  effects: [],
  requiresConfirmation: true,
};

function createEmptyDraft(sortOrder: number): AdminServiceResourceRequirementDraft {
  return {
    key: `new_${Date.now()}_${sortOrder}`,
    resourceType: "unknown",
    quantity: 1,
    necessity: "required",
    selectionMode: "any_of_type",
    selectedResourceIds: [],
    branchScope: "global",
    sortOrder,
  };
}

/**
 * Reusable Service Resource Requirements editor (Phase 30 + Phase 31).
 */
export function ServiceResourceRequirementsEditor({
  userId,
  serviceReference,
  view,
  canEdit,
  onSaved,
}: {
  userId: string;
  serviceReference: string;
  view: AdminServiceResourceRequirementsView;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const lastRowRef = useRef<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = useState<AdminServiceResourceRequirementDraft[]>(() =>
    draftsFromView(view),
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftsFromView(view)));
  const [rowErrors, setRowErrors] = useState<ReturnType<typeof validateAllRequirementDrafts>>({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [impact, setImpact] = useState<AdminServiceResourceRequirementsImpactPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [removeKey, setRemoveKey] = useState<string | null>(null);

  const dirty = JSON.stringify(drafts) !== baseline;

  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    enabled: view.capabilities.hasBranchScope,
    staleTime: 60_000,
  });
  const branchOptions = (branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name }));
  const typesQuery = useQuery(adminResourceTypesQueryOptions(userId));
  const typeOptions = typesQuery.data ?? [];

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const previewLines = useMemo(
    () => drafts.map((draft) => buildSummaryLineFromDraft(draft)),
    [drafts],
  );
  const duplicateWarnings = useMemo(() => {
    const pseudoItems = drafts.map((draft) => ({
      key: draft.key,
      resourceType: draft.resourceType,
      resourceTypeLabel: "",
      quantity: draft.quantity,
      necessity: draft.necessity,
      selectionMode: draft.selectionMode,
      specificSemantics: "unknown" as const,
      selectedResources: [],
      branchScope: draft.branchScope,
      branchId: draft.branchId,
    }));
    return detectDuplicateTypeWarnings(pseudoItems);
  }, [drafts]);

  const updateDraft = useCallback((key: string, patch: Partial<AdminServiceResourceRequirementDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  function addRequirement() {
    const next = createEmptyDraft(drafts.length + 1);
    setDrafts((current) => [...current, next]);
    requestAnimationFrame(() => {
      lastRowRef.current?.focus();
    });
  }

  function removeRequirement(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
    setRemoveKey(null);
  }

  function moveRequirement(key: string, direction: -1 | 1) {
    setDrafts((current) => {
      const index = current.findIndex((d) => d.key === key);
      if (index < 0) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next.map((draft, idx) => ({ ...draft, sortOrder: idx + 1 }));
    });
  }

  function prepareSave() {
    if (!canEdit || submitLock.current) return;
    const errors = validateAllRequirementDrafts(drafts, {
      hasBranchScope: view.capabilities.hasBranchScope,
    });
    setRowErrors(errors);
    if (Object.keys(errors).length) {
      setFormError("لطفاً خطاهای فرم را برطرف کنید.");
      return;
    }
    setFormError(undefined);
    setConflict(undefined);
    setImpact(SAVE_CONFIRMATION);
  }

  async function executeSave() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    setFormError(undefined);
    try {
      const result = await saveAdminServiceResourceRequirements(
        serviceReference,
        inputFromDrafts(drafts, view.version),
        createIdempotencyKey(),
      );
      if (result.partialFailures?.length) {
        setFormError(
          `ذخیره جزئی: ${result.partialFailures.map((f) => f.message).join(" ")}`,
        );
      }
      invalidateAfterServiceResourceRequirementsMutation(queryClient, userId, serviceReference, {
        affectsPublicAvailability: true,
      });
      setBaseline(JSON.stringify(drafts));
      setImpact(null);
      toast.success("نیازمندی‌های منبع ذخیره شد.");
      onSaved?.();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) return;
      if (isServiceResourceRequirementsConflict(apiError)) {
        setConflict(serviceResourceRequirementsConflictMessage());
        return;
      }
      if (isValidationError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("مجوز ذخیره نیازمندی‌ها را ندارید.");
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="admin-service-requirements-editor">
      {formError ? <Alert tone="error" title="ذخیره انجام نشد" description={formError} /> : null}
      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <Alert
        tone="info"
        title="تفکیک مفاهیم"
        description="مشتری فقط Slot نهایی و در صورت مجاز Provider را می‌بیند. اتاق، دستگاه و کارکنان داخلی هرگز در UI مشتری نمایش داده نمی‌شوند."
      />

      {drafts.length === 0 ? (
        <p className="ds-help">هنوز نیازمندی منبعی برای این خدمت تعریف نشده است.</p>
      ) : (
        <div className="admin-service-requirements-editor__rows" role="list">
          {drafts.map((draft, index) => (
            <div key={draft.key} role="listitem" ref={index === drafts.length - 1 ? lastRowRef : undefined}>
              <ServiceResourceRequirementRow
                serviceReference={serviceReference}
                draft={draft}
                index={index}
                errors={rowErrors[draft.key]}
                capabilities={view.capabilities}
                typeOptions={typeOptions}
                branchOptions={branchOptions}
                onChange={(patch) => updateDraft(draft.key, patch)}
                onRemove={() => setRemoveKey(draft.key)}
                onMoveUp={() => moveRequirement(draft.key, -1)}
                onMoveDown={() => moveRequirement(draft.key, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < drafts.length - 1}
                removeDisabled={!canEdit}
              />
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
        <Button type="button" variant="secondary" onClick={addRequirement}>
          افزودن نیازمندی
        </Button>
      ) : null}

      <ServiceResourceRequirementsSummary lines={previewLines} duplicateWarnings={duplicateWarnings} />

      {canEdit ? (
        <div className="booking-wizard__nav">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              if (dirty) setLeaveOpen(true);
              else setDrafts(JSON.parse(baseline) as AdminServiceResourceRequirementDraft[]);
            }}
          >
            بازنشانی
          </Button>
          <Button
            type="button"
            loading={saving}
            onClick={prepareSave}
          >
            ذخیره نیازمندی‌ها
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید ذخیره"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                ...(impact.branchWarnings ?? []),
                typeof impact.futureAppointmentCount === "number"
                  ? `نوبت‌های آینده: ${impact.futureAppointmentCount}`
                  : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ذخیره"}
        cancelLabel="انصراف"
        busy={saving}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          if (impact?.blocked) return;
          void executeSave();
        }}
      />

      <ConfirmDialog
        open={Boolean(removeKey)}
        title="حذف نیازمندی"
        description="این ردیف از پیش‌نویس حذف می‌شود. برای اعمال نهایی باید ذخیره کنید."
        confirmLabel="حذف"
        cancelLabel="انصراف"
        onCancel={() => setRemoveKey(null)}
        onConfirm={() => {
          if (removeKey) removeRequirement(removeKey);
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        title="بازنشانی تغییرات"
        description="تغییرات ذخیره‌نشده از بین می‌روند."
        confirmLabel="بازنشانی"
        cancelLabel="انصراف"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setDrafts(JSON.parse(baseline) as AdminServiceResourceRequirementDraft[]);
          setLeaveOpen(false);
          setRowErrors({});
        }}
      />
    </div>
  );
}
