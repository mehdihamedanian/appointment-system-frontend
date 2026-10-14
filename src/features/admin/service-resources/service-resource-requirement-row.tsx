"use client";

import { useEffect, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { InlineLoading } from "@/components/feedback/loading-states";
import { fetchEligibleResourcesForRequirement } from "@/lib/api/admin-service-resources";
import {
  ADMIN_REQUIREMENT_BRANCH_SCOPE_LABELS,
  ADMIN_REQUIREMENT_NECESSITY_LABELS,
  ADMIN_REQUIREMENT_SELECTION_MODE_LABELS,
  ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS,
  type AdminRequirementBranchScope,
  type AdminRequirementNecessity,
  type AdminRequirementSelectionMode,
  type AdminServiceResourceRequirementDraft,
  type AdminServiceResourceRequirementsCapabilities,
} from "@/types/admin-service-resource-requirement";
import type { AdminResourceTypeOption } from "@/types/admin-resource";
import type { RequirementRowErrors } from "@/lib/admin/service-resource-requirement-adapter";

export function ServiceResourceRequirementRow({
  serviceReference,
  draft,
  index,
  errors,
  capabilities,
  typeOptions,
  branchOptions,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  removeDisabled,
}: {
  serviceReference: string;
  draft: AdminServiceResourceRequirementDraft;
  index: number;
  errors?: RequirementRowErrors;
  capabilities: AdminServiceResourceRequirementsCapabilities;
  /** Backend resource types (`GET /resources/types`). */
  typeOptions: AdminResourceTypeOption[];
  branchOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<AdminServiceResourceRequirementDraft>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  removeDisabled?: boolean;
}) {
  const rowId = useId();
  const showSpecific = draft.selectionMode === "specific";
  const resourceTypeId = draft.resourceTypeId ?? "";
  const eligibleQuery = useQuery({
    queryKey: ["admin", "services", "eligible-resources", serviceReference, resourceTypeId],
    queryFn: ({ signal }) => fetchEligibleResourcesForRequirement(resourceTypeId, signal),
    enabled: showSpecific && Boolean(resourceTypeId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!showSpecific || !eligibleQuery.data?.items.length) return;
    const names = new Map(eligibleQuery.data.items.map((item) => [item.id, item.name]));
    const filtered = draft.selectedResourceIds.filter((id) => names.has(id));
    const unnamed = filtered.some((id) => draft.selectedResourceNames?.[id] !== names.get(id));
    if (filtered.length !== draft.selectedResourceIds.length || unnamed) {
      onChange({
        selectedResourceIds: filtered,
        selectedResourceNames: Object.fromEntries(filtered.map((id) => [id, names.get(id) ?? id])),
      });
    }
  }, [draft.selectedResourceIds, draft.selectedResourceNames, eligibleQuery.data?.items, onChange, showSpecific]);

  const semantics = eligibleQuery.data?.selectionSemantics;
  const isStaff = draft.resourceType === "staff";

  return (
    <article
      className="admin-service-requirement-row card"
      aria-labelledby={`${rowId}-title`}
      data-row-index={index}
    >
      <div className="admin-service-requirement-row__head">
        <h2 id={`${rowId}-title`} className="text-card-title">
          نیازمندی {index + 1}
        </h2>
        <div className="admin-service-requirement-row__actions">
          {capabilities.canReorder ? (
            <>
              <Button type="button" variant="ghost" disabled={!canMoveUp} onClick={onMoveUp}>
                بالا
              </Button>
              <Button type="button" variant="ghost" disabled={!canMoveDown} onClick={onMoveDown}>
                پایین
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={removeDisabled}
            onClick={onRemove}
          >
            حذف
          </Button>
        </div>
      </div>

      <FormField id={`${rowId}-type`} label="نوع منبع" required error={errors?.resourceType}>
        <Select
          id={`${rowId}-type`}
          value={draft.resourceTypeId}
          placeholder="انتخاب نوع منبع"
          disabled={typeOptions.length === 0}
          options={typeOptions.map((option) => ({ value: option.id, label: option.label }))}
          onChange={(value) => {
            const option = typeOptions.find((item) => item.id === value);
            if (!option) return;
            onChange({
              resourceTypeId: option.id,
              resourceType: option.type,
              selectedResourceIds: [],
              selectedResourceNames: {},
              providerSelectable: option.type === "staff" ? draft.providerSelectable : false,
            });
          }}
        />
      </FormField>

      <FormField
        id={`${rowId}-qty`}
        label="تعداد"
        required
        description="تعداد منابع موردنیاز — جدا از ظرفیت هر منبع."
        error={errors?.quantity}
      >
        <Input
          id={`${rowId}-qty`}
          type="number"
          min={1}
          className="ltr-value"
          dir="ltr"
          value={draft.quantity}
          invalid={Boolean(errors?.quantity)}
          onChange={(event) => onChange({ quantity: Number(event.target.value) || 1 })}
        />
      </FormField>

      <FormField id={`${rowId}-necessity`} label="الزام" required error={errors?.necessity}>
        <Select
          id={`${rowId}-necessity`}
          value={draft.necessity}
          options={Object.entries(ADMIN_REQUIREMENT_NECESSITY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) =>
            onChange({ necessity: (value as AdminRequirementNecessity) ?? "required" })
          }
        />
        <p className="ds-help">
          {draft.necessity === "required"
            ? "بدون این منبع، رزرو/Slot معتبر تولید نمی‌شود."
            : "نبود این منبع مانع رزرو نمی‌شود."}
        </p>
      </FormField>

      <FormField id={`${rowId}-mode`} label="حالت انتخاب" required error={errors?.selectionMode}>
        <Select
          id={`${rowId}-mode`}
          value={draft.selectionMode}
          options={Object.entries(ADMIN_REQUIREMENT_SELECTION_MODE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) =>
            onChange({
              selectionMode: (value as AdminRequirementSelectionMode) ?? "any_of_type",
              selectedResourceIds: value === "specific" ? draft.selectedResourceIds : [],
            })
          }
        />
        <p className="ds-help">
          {draft.selectionMode === "any_of_type"
            ? "Backend هر منبع فعال و واجد شرایط از این نوع را تخصیص می‌دهد."
            : "باید از فهرست واجد شرایط Backend انتخاب کنید."}
        </p>
      </FormField>

      {showSpecific ? (
        <FormField
          id={`${rowId}-specific`}
          label="منابع مشخص"
          required
          error={errors?.selectedResourceIds}
        >
          {eligibleQuery.isFetching ? <InlineLoading label="بارگذاری منابع واجد شرایط" /> : null}
          {eligibleQuery.isError ? (
            <Alert tone="warning" title="منابع واجد شرایط دریافت نشد" description="اتصال را بررسی و دوباره تلاش کنید." />
          ) : null}
          <MultiSelect
            id={`${rowId}-specific`}
            values={draft.selectedResourceIds}
            disabled={!resourceTypeId || eligibleQuery.isPending}
            options={(eligibleQuery.data?.items ?? []).map((item) => ({
              value: item.id,
              label: item.branchName ? `${item.name} (${item.branchName})` : item.name,
            }))}
            emptyLabel="منبع واجد شرایطی نیست"
            onChange={(values) => {
              const names = Object.fromEntries(
                (eligibleQuery.data?.items ?? [])
                  .filter((item) => values.includes(item.id))
                  .map((item) => [item.id, item.name]),
              );
              for (const id of values) {
                if (!names[id]) {
                  names[id] = draft.selectedResourceNames?.[id] ?? id;
                }
              }
              onChange({ selectedResourceIds: values, selectedResourceNames: names });
            }}
          />
          {semantics && semantics !== "unknown" ? (
            <p className="ds-help">{ADMIN_REQUIREMENT_SPECIFIC_SEMANTICS_LABELS[semantics]}</p>
          ) : eligibleQuery.data?.semanticsLabel ? (
            <p className="ds-help">{eligibleQuery.data.semanticsLabel}</p>
          ) : (
            <p className="ds-help">
              با یک منبع، همان منبع رزرو می‌شود؛ با چند منبع، یکی از آن‌ها به‌عنوان جایگزین تخصیص می‌یابد.
            </p>
          )}
        </FormField>
      ) : null}

      {capabilities.hasBranchScope ? (
        <>
          <FormField id={`${rowId}-scope`} label="محدوده شعبه" error={errors?.branchId}>
            <Select
              id={`${rowId}-scope`}
              value={draft.branchScope}
              options={Object.entries(ADMIN_REQUIREMENT_BRANCH_SCOPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                onChange({
                  branchScope: (value as AdminRequirementBranchScope) ?? "global",
                  branchId: value === "branch" ? draft.branchId : undefined,
                  selectedResourceIds: [],
                })
              }
            />
          </FormField>
          {draft.branchScope === "branch" ? (
            <FormField id={`${rowId}-branch`} label="شعبه" required error={errors?.branchId}>
              <Select
                id={`${rowId}-branch`}
                value={draft.branchId}
                options={branchOptions}
                onChange={(value) =>
                  onChange({ branchId: value, selectedResourceIds: [] })
                }
              />
            </FormField>
          ) : null}
        </>
      ) : null}

      {isStaff && capabilities.hasStaffRole ? (
        <FormField id={`${rowId}-role`} label="نقش/سمت (اختیاری)" error={errors?.staffRole}>
          <Input
            id={`${rowId}-role`}
            value={draft.staffRole ?? ""}
            placeholder="مثلاً تکنسین MRI"
            onChange={(event) => onChange({ staffRole: event.target.value })}
          />
        </FormField>
      ) : null}

      {isStaff && capabilities.hasProviderSelectable ? (
        <Switch
          label="قابل انتخاب توسط مشتری (Provider)"
          description="مستقل از الزام داخلی — فقط وقتی Backend اجازه دهد در UI مشتری نمایش داده می‌شود."
          checked={Boolean(draft.providerSelectable)}
          onCheckedChange={(checked) => onChange({ providerSelectable: checked })}
        />
      ) : null}

      {isStaff && !draft.providerSelectable ? (
        <p className="ds-help">این نیازمندی کارمند داخلی است و به مشتری نمایش داده نمی‌شود.</p>
      ) : null}
    </article>
  );
}
