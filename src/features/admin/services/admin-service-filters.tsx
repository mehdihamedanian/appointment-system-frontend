"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_SERVICE_ACTIVE_FILTER_LABELS,
  ADMIN_SERVICE_SORT_LABELS,
  type AdminServiceActiveFilter,
  type AdminServiceFilterOptions,
  type AdminServiceListFilters,
  type AdminServiceSortField,
} from "@/types/admin-service";

export function AdminServiceFilters({
  open,
  onClose,
  filters,
  options,
  showBranch,
  onChange,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  filters: AdminServiceListFilters;
  options?: AdminServiceFilterOptions;
  showBranch: boolean;
  onChange: (patch: Partial<AdminServiceListFilters>) => void;
  onClear: () => void;
}) {
  const activeOptions = Object.entries(ADMIN_SERVICE_ACTIVE_FILTER_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  const sortOptions = Object.entries(ADMIN_SERVICE_SORT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Drawer open={open} onClose={onClose} title="فیلتر خدمات" placement="bottom">
      <div className="admin-service-filters">
        <FormField id="service-active" label="وضعیت">
          <Select
            id="service-active"
            value={filters.active}
            options={activeOptions}
            onChange={(value) =>
              onChange({ active: (value as AdminServiceActiveFilter) ?? "all", page: 1 })
            }
          />
        </FormField>
        {showBranch ? (
          <FormField id="service-branch" label="شعبه">
            <Select
              id="service-branch"
              value={filters.branchId}
              allowClear
              placeholder="همه شعب"
              options={(options?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              onChange={(value) => onChange({ branchId: value, page: 1 })}
            />
          </FormField>
        ) : null}
        <FormField id="service-provider" label="Provider">
          <Select
            id="service-provider"
            value={filters.providerId}
            allowClear
            placeholder="همه"
            options={(options?.providers ?? []).map((p) => ({ value: p.id, label: p.name }))}
            onChange={(value) => onChange({ providerId: value, page: 1 })}
          />
        </FormField>
        {(options?.resourceTypes?.length ?? 0) > 0 ? (
          <FormField id="service-resource-type" label="نوع منبع">
            <Select
              id="service-resource-type"
              value={filters.resourceType}
              allowClear
              placeholder="همه"
              options={options!.resourceTypes!.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(value) => onChange({ resourceType: value, page: 1 })}
            />
          </FormField>
        ) : null}
        <FormField id="service-sort" label="مرتب‌سازی">
          <Select
            id="service-sort"
            value={filters.sort}
            options={sortOptions}
            onChange={(value) =>
              onChange({ sort: (value as AdminServiceSortField) ?? "sortOrder", page: 1 })
            }
          />
        </FormField>
        <div className="booking-wizard__nav">
          <Button type="button" variant="ghost" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
          <Button type="button" onClick={onClose}>
            اعمال
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
