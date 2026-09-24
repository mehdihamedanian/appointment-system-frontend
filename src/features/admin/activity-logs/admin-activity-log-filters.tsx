"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS,
  ADMIN_ACTIVITY_LOG_RESULT_FILTERS,
  ADMIN_ACTIVITY_LOG_RESULT_LABELS,
  ADMIN_ACTIVITY_LOG_SORT_FIELDS,
  type AdminActivityLogFilterOptions,
  type AdminActivityLogListFilters,
  type AdminActivityLogResultFilter,
  type AdminActivityLogSortField,
} from "@/types/admin-activity-log";

const SORT_LABELS: Record<AdminActivityLogSortField, string> = {
  occurredAt: "زمان",
  actor: "عامل",
  action: "اقدام",
  entityType: "نوع موجودیت",
  result: "نتیجه",
};

function FilterFields({
  filters,
  options,
  showBranch,
  onChange,
}: {
  filters: AdminActivityLogListFilters;
  options?: AdminActivityLogFilterOptions;
  showBranch: boolean;
  onChange: (next: Partial<AdminActivityLogListFilters>) => void;
}) {
  const actionOptions = [
    { value: "all", label: "همه اقدام‌ها" },
    ...(options?.actions ?? []).map((item) => ({
      value: item.id,
      label: item.label,
    })),
  ];
  const entityOptions = [
    { value: "all", label: "همه انواع" },
    ...(options?.entityTypes?.length
      ? options.entityTypes.map((item) => ({ value: item.id, label: item.label }))
      : Object.entries(ADMIN_ACTIVITY_LOG_ENTITY_TYPE_LABELS)
          .filter(([key]) => key !== "unknown")
          .map(([value, label]) => ({ value, label }))),
  ];
  const actorOptions = [
    { value: "all", label: "همه عامل‌ها" },
    ...(options?.actors ?? []).map((item) => ({
      value: item.id,
      label: item.label,
    })),
  ];

  return (
    <div className="admin-activity-log-filters__grid">
      <FormField id="al-actor" label="عامل">
        <Select
          id="al-actor"
          value={filters.actorReference ?? "all"}
          options={actorOptions}
          onChange={(value) =>
            onChange({
              actorReference: !value || value === "all" ? undefined : value,
              page: 1,
            })
          }
        />
      </FormField>
      <FormField id="al-action" label="اقدام">
        <Select
          id="al-action"
          value={filters.action}
          options={actionOptions}
          onChange={(value) =>
            value && onChange({ action: value, page: 1 })
          }
        />
      </FormField>
      <FormField id="al-entity" label="نوع موجودیت">
        <Select
          id="al-entity"
          value={filters.entityType}
          options={entityOptions}
          onChange={(value) => value && onChange({ entityType: value, page: 1 })}
        />
      </FormField>
      <FormField id="al-result" label="نتیجه">
        <Select
          id="al-result"
          value={filters.result}
          options={ADMIN_ACTIVITY_LOG_RESULT_FILTERS.map((value) => ({
            value,
            label:
              value === "all"
                ? "همه نتایج"
                : ADMIN_ACTIVITY_LOG_RESULT_LABELS[value as Exclude<AdminActivityLogResultFilter, "all">],
          }))}
          onChange={(value) =>
            value &&
            onChange({
              result: value as AdminActivityLogResultFilter,
              page: 1,
            })
          }
        />
      </FormField>
      <FormField id="al-from" label="از تاریخ" optional>
        <Input
          id="al-from"
          type="date"
          value={filters.from ?? ""}
          onChange={(event) =>
            onChange({ from: event.target.value || undefined, page: 1 })
          }
        />
      </FormField>
      <FormField id="al-to" label="تا تاریخ" optional>
        <Input
          id="al-to"
          type="date"
          value={filters.to ?? ""}
          onChange={(event) =>
            onChange({ to: event.target.value || undefined, page: 1 })
          }
        />
      </FormField>
      {showBranch ? (
        <FormField id="al-branch" label="شعبه" optional>
          <Select
            id="al-branch"
            value={filters.branchId ?? "all"}
            options={[
              { value: "all", label: "همه شعبه‌ها" },
              ...(options?.branches ?? []).map((item) => ({
                value: item.id,
                label: item.label,
              })),
            ]}
            onChange={(value) =>
              onChange({
                branchId: !value || value === "all" ? undefined : value,
                page: 1,
              })
            }
          />
        </FormField>
      ) : null}
      <FormField id="al-sort" label="مرتب‌سازی">
        <Select
          id="al-sort"
          value={filters.sort}
          options={ADMIN_ACTIVITY_LOG_SORT_FIELDS.map((value) => ({
            value,
            label: SORT_LABELS[value],
          }))}
          onChange={(value) =>
            value &&
            onChange({ sort: value as AdminActivityLogSortField, page: 1 })
          }
        />
      </FormField>
      <FormField id="al-direction" label="ترتیب">
        <Select
          id="al-direction"
          value={filters.direction}
          options={[
            { value: "desc", label: "نزولی" },
            { value: "asc", label: "صعودی" },
          ]}
          onChange={(value) =>
            value &&
            onChange({
              direction: value === "asc" ? "asc" : "desc",
              page: 1,
            })
          }
        />
      </FormField>
    </div>
  );
}

export function AdminActivityLogFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminActivityLogListFilters;
  options?: AdminActivityLogFilterOptions;
  showBranchFilter: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminActivityLogListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-activity-log-filters admin-activity-log-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranch={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-activity-log-filters__actions">
          <Button type="button" variant="secondary" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        title="فیلتر گزارش فعالیت"
        placement="bottom"
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranch={showBranchFilter}
          onChange={(next) => {
            onChange(next);
          }}
        />
        <div className="admin-activity-log-filters__drawer-actions">
          <Button type="button" variant="secondary" onClick={onClear}>
            پاک کردن
          </Button>
          <Button type="button" onClick={() => onMobileOpenChange(false)}>
            اعمال
          </Button>
        </div>
      </Drawer>
    </>
  );
}
