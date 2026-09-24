"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_RESOURCE_ACTIVE_FILTER_LABELS,
  ADMIN_RESOURCE_SORT_LABELS,
  ADMIN_RESOURCE_TYPE_LABELS,
  ADMIN_RESOURCE_TYPES,
  type AdminResourceActiveFilter,
  type AdminResourceFilterOptions,
  type AdminResourceListFilters,
  type AdminResourceSortField,
} from "@/types/admin-resource";

export function AdminResourceFilters({
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
  filters: AdminResourceListFilters;
  options?: AdminResourceFilterOptions;
  showBranch: boolean;
  onChange: (patch: Partial<AdminResourceListFilters>) => void;
  onClear: () => void;
}) {
  const typeOptions = [
    { value: "all", label: "همه انواع" },
    ...(options?.types?.length
      ? options.types
      : ADMIN_RESOURCE_TYPES.map((type) => ({
          value: type,
          label: ADMIN_RESOURCE_TYPE_LABELS[type],
        }))),
  ];
  const activeOptions = Object.entries(ADMIN_RESOURCE_ACTIVE_FILTER_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  const sortOptions = Object.entries(ADMIN_RESOURCE_SORT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Drawer open={open} onClose={onClose} title="فیلتر منابع" placement="bottom">
      <div className="admin-resource-filters">
        <FormField id="resource-type" label="نوع منبع">
          <Select
            id="resource-type"
            value={filters.type}
            options={typeOptions}
            onChange={(value) => onChange({ type: value ?? "all", page: 1 })}
          />
        </FormField>
        {showBranch ? (
          <FormField id="resource-branch" label="شعبه">
            <Select
              id="resource-branch"
              value={filters.branchId}
              allowClear
              placeholder="همه شعب"
              options={(options?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              onChange={(value) => onChange({ branchId: value, page: 1 })}
            />
          </FormField>
        ) : null}
        <FormField id="resource-service" label="خدمت مرتبط">
          <Select
            id="resource-service"
            value={filters.serviceId}
            allowClear
            placeholder="همه خدمات"
            options={(options?.services ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(value) => onChange({ serviceId: value, page: 1 })}
          />
        </FormField>
        <FormField id="resource-active" label="وضعیت">
          <Select
            id="resource-active"
            value={filters.active}
            options={activeOptions}
            onChange={(value) =>
              onChange({ active: (value as AdminResourceActiveFilter) ?? "all", page: 1 })
            }
          />
        </FormField>
        <FormField id="resource-sort" label="مرتب‌سازی">
          <Select
            id="resource-sort"
            value={filters.sort}
            options={sortOptions}
            onChange={(value) =>
              onChange({ sort: (value as AdminResourceSortField) ?? "name", page: 1 })
            }
          />
        </FormField>
        <FormField id="resource-direction" label="جهت">
          <Select
            id="resource-direction"
            value={filters.direction}
            options={[
              { value: "asc", label: "صعودی" },
              { value: "desc", label: "نزولی" },
            ]}
            onChange={(value) =>
              onChange({ direction: value === "desc" ? "desc" : "asc", page: 1 })
            }
          />
        </FormField>
        <div className="booking-wizard__nav">
          <Button variant="ghost" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
          <Button onClick={onClose}>اعمال</Button>
        </div>
      </div>
    </Drawer>
  );
}
