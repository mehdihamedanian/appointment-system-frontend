"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  ADMIN_WAITING_LIST_ENTRY_STATUS_FILTER_LABELS,
  ADMIN_WAITING_LIST_OFFER_STATUS_FILTER_LABELS,
  ADMIN_WAITING_LIST_SORT_LABELS,
  type AdminWaitingListFilterOptions,
  type AdminWaitingListListFilters,
} from "@/types/admin-waiting-list";
import {
  ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS,
  ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS,
  ADMIN_WAITING_LIST_SORT_FIELDS,
} from "@/types/admin-waiting-list";

function FilterFields({
  filters,
  options,
  showBranchFilter,
  onChange,
}: {
  filters: AdminWaitingListListFilters;
  options?: AdminWaitingListFilterOptions;
  showBranchFilter?: boolean;
  onChange: (next: Partial<AdminWaitingListListFilters>) => void;
}) {
  const entryStatusOptions = ADMIN_WAITING_LIST_ENTRY_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_WAITING_LIST_ENTRY_STATUS_FILTER_LABELS[value],
  }));
  const offerStatusOptions = ADMIN_WAITING_LIST_OFFER_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_WAITING_LIST_OFFER_STATUS_FILTER_LABELS[value],
  }));
  const sortOptions = ADMIN_WAITING_LIST_SORT_FIELDS.map((value) => ({
    value,
    label: ADMIN_WAITING_LIST_SORT_LABELS[value],
  }));
  const directionOptions = [
    { value: "desc", label: "نزولی" },
    { value: "asc", label: "صعودی" },
  ];
  const serviceOptions = useMemo(
    () => [
      { value: "all", label: "همه خدمات" },
      ...(options?.services?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.services],
  );
  const providerOptions = useMemo(
    () => [
      { value: "all", label: "همه ارائه‌دهندگان" },
      ...(options?.providers?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.providers],
  );
  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.branches],
  );

  return (
    <div className="admin-waiting-list-filters__grid">
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-entry-status">وضعیت درخواست</Label>
        <Select
          id="admin-wl-entry-status"
          value={filters.entryStatus}
          options={entryStatusOptions}
          onChange={(value) =>
            onChange({
              entryStatus: (value as AdminWaitingListListFilters["entryStatus"]) ?? "all",
              page: 1,
            })
          }
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-offer-status">وضعیت پیشنهاد</Label>
        <Select
          id="admin-wl-offer-status"
          value={filters.offerStatus}
          options={offerStatusOptions}
          onChange={(value) =>
            onChange({
              offerStatus: (value as AdminWaitingListListFilters["offerStatus"]) ?? "all",
              page: 1,
            })
          }
        />
      </div>
      {options?.services?.length ? (
        <div className="admin-waiting-list-filters__field">
          <Label htmlFor="admin-wl-service">خدمت</Label>
          <Select
            id="admin-wl-service"
            value={filters.serviceId ?? "all"}
            options={serviceOptions}
            onChange={(value) =>
              onChange({ serviceId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {options?.providers?.length ? (
        <div className="admin-waiting-list-filters__field">
          <Label htmlFor="admin-wl-provider">ارائه‌دهنده</Label>
          <Select
            id="admin-wl-provider"
            value={filters.providerId ?? "all"}
            options={providerOptions}
            onChange={(value) =>
              onChange({ providerId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {showBranchFilter && options?.branches?.length ? (
        <div className="admin-waiting-list-filters__field">
          <Label htmlFor="admin-wl-branch">شعبه</Label>
          <Select
            id="admin-wl-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({ branchId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-preferred-from">ترجیح از تاریخ</Label>
        <Input
          id="admin-wl-preferred-from"
          type="date"
          value={filters.preferredFrom ?? ""}
          onChange={(event) => onChange({ preferredFrom: event.target.value || undefined, page: 1 })}
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-preferred-to">ترجیح تا تاریخ</Label>
        <Input
          id="admin-wl-preferred-to"
          type="date"
          value={filters.preferredTo ?? ""}
          onChange={(event) => onChange({ preferredTo: event.target.value || undefined, page: 1 })}
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-created-from">ثبت از</Label>
        <Input
          id="admin-wl-created-from"
          type="date"
          value={filters.createdFrom ?? ""}
          onChange={(event) => onChange({ createdFrom: event.target.value || undefined, page: 1 })}
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-created-to">ثبت تا</Label>
        <Input
          id="admin-wl-created-to"
          type="date"
          value={filters.createdTo ?? ""}
          onChange={(event) => onChange({ createdTo: event.target.value || undefined, page: 1 })}
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-sort">مرتب‌سازی</Label>
        <Select
          id="admin-wl-sort"
          value={filters.sort}
          options={sortOptions}
          onChange={(value) =>
            onChange({ sort: (value as AdminWaitingListListFilters["sort"]) ?? "createdAt", page: 1 })
          }
        />
      </div>
      <div className="admin-waiting-list-filters__field">
        <Label htmlFor="admin-wl-direction">جهت</Label>
        <Select
          id="admin-wl-direction"
          value={filters.direction}
          options={directionOptions}
          onChange={(value) =>
            onChange({
              direction: (value as AdminWaitingListListFilters["direction"]) ?? "desc",
              page: 1,
            })
          }
        />
      </div>
    </div>
  );
}

export function AdminWaitingListFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminWaitingListListFilters;
  options?: AdminWaitingListFilterOptions;
  showBranchFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminWaitingListListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-waiting-list-filters admin-waiting-list-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-waiting-list-filters__actions">
          <Button type="button" variant="secondary" size="sm" onClick={onClear}>
            پاک‌سازی فیلترها
          </Button>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        title="فیلتر لیست انتظار"
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-waiting-list-filters__drawer-actions">
          <Button type="button" variant="secondary" onClick={onClear}>
            پاک‌سازی
          </Button>
          <Button type="button" onClick={() => onMobileOpenChange(false)}>
            اعمال
          </Button>
        </div>
      </Drawer>
    </>
  );
}
