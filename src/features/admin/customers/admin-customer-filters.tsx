"use client";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ADMIN_CUSTOMER_ACTIVE_FILTERS,
  ADMIN_CUSTOMER_LIFECYCLE_LABELS,
  type AdminCustomerFilterOptions,
  type AdminCustomerListFilters,
} from "@/types/admin-customer";

const ACTIVE_OPTIONS = ADMIN_CUSTOMER_ACTIVE_FILTERS.map((value) => ({
  value,
  label:
    value === "all"
      ? "همه وضعیت‌ها"
      : ADMIN_CUSTOMER_LIFECYCLE_LABELS[value as keyof typeof ADMIN_CUSTOMER_LIFECYCLE_LABELS],
}));

const UPCOMING_OPTIONS = [
  { value: "all", label: "همه" },
  { value: "has_upcoming", label: "دارای نوبت آینده" },
  { value: "none", label: "بدون نوبت آینده" },
];

export function AdminCustomerFilters({
  filters,
  options,
  onChange,
}: {
  filters: AdminCustomerListFilters;
  options?: AdminCustomerFilterOptions;
  onChange: (next: Partial<AdminCustomerListFilters>) => void;
}) {
  const serviceOptions = [
    { value: "", label: "همه خدمات" },
    ...(options?.services?.map((s) => ({ value: s.id, label: s.name })) ?? []),
  ];
  const branchOptions = [
    { value: "", label: "همه شعب" },
    ...(options?.branches?.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];
  const tagOptions = [
    { value: "", label: "همه برچسب‌ها" },
    ...(options?.tags?.map((t) => ({ value: t.id, label: t.name })) ?? []),
  ];

  return (
    <section className="admin-customer-filters ds-card" aria-label="فیلتر مشتریان">
      <div className="admin-customer-filters__grid">
        <FormField id="customer-filter-active" label="وضعیت">
          <Select
            id="customer-filter-active"
            value={filters.active}
            options={ACTIVE_OPTIONS}
            onChange={(value) => onChange({ active: (value as AdminCustomerListFilters["active"]) ?? "all", page: 1 })}
          />
        </FormField>
        <FormField id="customer-filter-upcoming" label="نوبت آینده">
          <Select
            id="customer-filter-upcoming"
            value={filters.upcoming}
            options={UPCOMING_OPTIONS}
            onChange={(value) =>
              onChange({ upcoming: (value as AdminCustomerListFilters["upcoming"]) ?? "all", page: 1 })
            }
          />
        </FormField>
        <FormField id="customer-filter-service" label="خدمت">
          <Select
            id="customer-filter-service"
            value={filters.serviceId ?? ""}
            options={serviceOptions}
            onChange={(value) => onChange({ serviceId: value || undefined, page: 1 })}
          />
        </FormField>
        <FormField id="customer-filter-branch" label="شعبه">
          <Select
            id="customer-filter-branch"
            value={filters.branchId ?? ""}
            options={branchOptions}
            onChange={(value) => onChange({ branchId: value || undefined, page: 1 })}
          />
        </FormField>
        <FormField id="customer-filter-tag" label="برچسب">
          <Select
            id="customer-filter-tag"
            value={filters.tagId ?? ""}
            options={tagOptions}
            onChange={(value) => onChange({ tagId: value || undefined, page: 1 })}
          />
        </FormField>
        <FormField id="customer-filter-last-from" label="آخرین مراجعه از">
          <Input
            id="customer-filter-last-from"
            type="date"
            className="ltr-value"
            value={filters.lastVisitFrom ?? ""}
            onChange={(event) => onChange({ lastVisitFrom: event.target.value || undefined, page: 1 })}
          />
        </FormField>
        <FormField id="customer-filter-last-to" label="تا">
          <Input
            id="customer-filter-last-to"
            type="date"
            className="ltr-value"
            value={filters.lastVisitTo ?? ""}
            onChange={(event) => onChange({ lastVisitTo: event.target.value || undefined, page: 1 })}
          />
        </FormField>
      </div>
    </section>
  );
}
