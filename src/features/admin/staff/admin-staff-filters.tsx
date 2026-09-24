"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_STAFF_ACTIVE_FILTER_LABELS,
  ADMIN_STAFF_BOOKABLE_FILTER_LABELS,
  ADMIN_STAFF_SORT_LABELS,
  ADMIN_STAFF_VISIBILITY_FILTER_LABELS,
  type AdminStaffActiveFilter,
  type AdminStaffBookableFilter,
  type AdminStaffFilterOptions,
  type AdminStaffListFilters,
  type AdminStaffSortField,
  type AdminStaffVisibilityFilter,
} from "@/types/admin-staff";

export function AdminStaffFilters({
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
  filters: AdminStaffListFilters;
  options?: AdminStaffFilterOptions;
  showBranch: boolean;
  onChange: (patch: Partial<AdminStaffListFilters>) => void;
  onClear: () => void;
}) {
  const activeOptions = Object.entries(ADMIN_STAFF_ACTIVE_FILTER_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  const visibleOptions = Object.entries(ADMIN_STAFF_VISIBILITY_FILTER_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  const bookableOptions = Object.entries(ADMIN_STAFF_BOOKABLE_FILTER_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  const sortOptions = Object.entries(ADMIN_STAFF_SORT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Drawer open={open} onClose={onClose} title="فیلتر کارکنان" placement="bottom">
      <div className="admin-staff-filters">
        <FormField id="staff-active" label="وضعیت">
          <Select
            id="staff-active"
            value={filters.active}
            options={activeOptions}
            onChange={(value) =>
              onChange({ active: (value as AdminStaffActiveFilter) ?? "all", page: 1 })
            }
          />
        </FormField>
        <FormField id="staff-visible" label="نمایش برای مشتری">
          <Select
            id="staff-visible"
            value={filters.customerVisible}
            options={visibleOptions}
            onChange={(value) =>
              onChange({
                customerVisible: (value as AdminStaffVisibilityFilter) ?? "all",
                page: 1,
              })
            }
          />
        </FormField>
        <FormField id="staff-bookable" label="قابلیت رزرو">
          <Select
            id="staff-bookable"
            value={filters.bookable}
            options={bookableOptions}
            onChange={(value) =>
              onChange({ bookable: (value as AdminStaffBookableFilter) ?? "all", page: 1 })
            }
          />
        </FormField>
        {showBranch ? (
          <FormField id="staff-branch" label="شعبه">
            <Select
              id="staff-branch"
              value={filters.branchId}
              allowClear
              placeholder="همه شعب"
              options={(options?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              onChange={(value) => onChange({ branchId: value, page: 1 })}
            />
          </FormField>
        ) : null}
        <FormField id="staff-service" label="خدمت">
          <Select
            id="staff-service"
            value={filters.serviceId}
            allowClear
            placeholder="همه خدمات"
            options={(options?.services ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(value) => onChange({ serviceId: value, page: 1 })}
          />
        </FormField>
        {options?.jobTitles?.length ? (
          <FormField id="staff-job-title" label="سمت">
            <Select
              id="staff-job-title"
              value={filters.jobTitle}
              allowClear
              placeholder="همه"
              options={options.jobTitles.map((j) => ({ value: j.value, label: j.label }))}
              onChange={(value) => onChange({ jobTitle: value, page: 1 })}
            />
          </FormField>
        ) : null}
        {options?.specialties?.length ? (
          <FormField id="staff-specialty" label="تخصص">
            <Select
              id="staff-specialty"
              value={filters.specialty}
              allowClear
              placeholder="همه"
              options={options.specialties.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(value) => onChange({ specialty: value, page: 1 })}
            />
          </FormField>
        ) : null}
        <FormField id="staff-sort" label="مرتب‌سازی">
          <Select
            id="staff-sort"
            value={filters.sort}
            options={sortOptions}
            onChange={(value) =>
              onChange({ sort: (value as AdminStaffSortField) ?? "name", page: 1 })
            }
          />
        </FormField>
        <FormField id="staff-direction" label="جهت">
          <Select
            id="staff-direction"
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
          <Button type="button" variant="ghost" onClick={onClear}>
            پاک کردن
          </Button>
          <Button type="button" onClick={onClose}>
            اعمال
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
