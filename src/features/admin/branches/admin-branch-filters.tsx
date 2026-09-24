"use client";

import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_BRANCH_LIFECYCLE_LABELS,
  type AdminBranchListFilters,
} from "@/types/admin-branch";

const ACTIVE_OPTIONS = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "active", label: ADMIN_BRANCH_LIFECYCLE_LABELS.active },
  { value: "inactive", label: ADMIN_BRANCH_LIFECYCLE_LABELS.inactive },
  { value: "archived", label: ADMIN_BRANCH_LIFECYCLE_LABELS.archived },
];

export function AdminBranchFilters({
  filters,
  onChange,
}: {
  filters: AdminBranchListFilters;
  onChange: (next: Partial<AdminBranchListFilters>) => void;
}) {
  return (
    <div className="admin-branch-filters">
      <FormField id="branch-active-filter" label="وضعیت">
        <Select
          id="branch-active-filter"
          value={filters.active}
          options={ACTIVE_OPTIONS}
          onChange={(value) => onChange({ active: (value as AdminBranchListFilters["active"]) ?? "all", page: 1 })}
          allowClear={false}
        />
      </FormField>
    </div>
  );
}
