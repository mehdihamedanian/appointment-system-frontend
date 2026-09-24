"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  ADMIN_COUPON_DISCOUNT_TYPE_FILTERS,
  ADMIN_COUPON_DISCOUNT_TYPE_LABELS,
  ADMIN_COUPON_SORT_FIELDS,
  ADMIN_COUPON_SORT_LABELS,
  ADMIN_COUPON_STATUS_FILTERS,
  ADMIN_COUPON_STATUS_LABELS,
  ADMIN_COUPON_VALIDITY_FILTERS,
  ADMIN_COUPON_VALIDITY_LABELS,
  type AdminCouponFilterOptions,
  type AdminCouponListFilters,
} from "@/types/admin-coupon";

function FilterFields({
  filters,
  options,
  showBranchFilter,
  onChange,
}: {
  filters: AdminCouponListFilters;
  options?: AdminCouponFilterOptions;
  showBranchFilter?: boolean;
  onChange: (next: Partial<AdminCouponListFilters>) => void;
}) {
  const statusOptions = ADMIN_COUPON_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_COUPON_STATUS_LABELS[value],
  }));
  const discountOptions = ADMIN_COUPON_DISCOUNT_TYPE_FILTERS.map((value) => ({
    value,
    label: ADMIN_COUPON_DISCOUNT_TYPE_LABELS[value],
  }));
  const validityOptions = ADMIN_COUPON_VALIDITY_FILTERS.map((value) => ({
    value,
    label: ADMIN_COUPON_VALIDITY_LABELS[value],
  }));
  const sortOptions = ADMIN_COUPON_SORT_FIELDS.map((value) => ({
    value,
    label: ADMIN_COUPON_SORT_LABELS[value],
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
  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.branches],
  );

  return (
    <div className="admin-coupon-filters__grid">
      <div className="admin-coupon-filters__field">
        <Label htmlFor="admin-coupon-status">وضعیت</Label>
        <Select
          id="admin-coupon-status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) =>
            onChange({ status: (value as AdminCouponListFilters["status"]) ?? "all", page: 1 })
          }
        />
      </div>
      <div className="admin-coupon-filters__field">
        <Label htmlFor="admin-coupon-discount-type">نوع تخفیف</Label>
        <Select
          id="admin-coupon-discount-type"
          value={filters.discountType}
          options={discountOptions}
          onChange={(value) =>
            onChange({
              discountType: (value as AdminCouponListFilters["discountType"]) ?? "all",
              page: 1,
            })
          }
        />
      </div>
      <div className="admin-coupon-filters__field">
        <Label htmlFor="admin-coupon-validity">بازه اعتبار</Label>
        <Select
          id="admin-coupon-validity"
          value={filters.validity}
          options={validityOptions}
          onChange={(value) =>
            onChange({ validity: (value as AdminCouponListFilters["validity"]) ?? "all", page: 1 })
          }
        />
      </div>
      {options?.services?.length ? (
        <div className="admin-coupon-filters__field">
          <Label htmlFor="admin-coupon-service">خدمت</Label>
          <Select
            id="admin-coupon-service"
            value={filters.serviceId ?? "all"}
            options={serviceOptions}
            onChange={(value) =>
              onChange({ serviceId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {showBranchFilter && options?.branches?.length ? (
        <div className="admin-coupon-filters__field">
          <Label htmlFor="admin-coupon-branch">شعبه</Label>
          <Select
            id="admin-coupon-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({ branchId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      <div className="admin-coupon-filters__field">
        <Label htmlFor="admin-coupon-sort">مرتب‌سازی</Label>
        <Select
          id="admin-coupon-sort"
          value={filters.sort}
          options={sortOptions}
          onChange={(value) =>
            onChange({ sort: (value as AdminCouponListFilters["sort"]) ?? "updatedAt", page: 1 })
          }
        />
      </div>
      <div className="admin-coupon-filters__field">
        <Label htmlFor="admin-coupon-direction">جهت</Label>
        <Select
          id="admin-coupon-direction"
          value={filters.direction}
          options={directionOptions}
          onChange={(value) =>
            onChange({
              direction: (value as AdminCouponListFilters["direction"]) ?? "desc",
              page: 1,
            })
          }
        />
      </div>
    </div>
  );
}

export function AdminCouponFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminCouponListFilters;
  options?: AdminCouponFilterOptions;
  showBranchFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminCouponListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-coupon-filters admin-coupon-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-coupon-filters__actions">
          <Button type="button" variant="secondary" size="sm" onClick={onClear}>
            پاک‌سازی فیلترها
          </Button>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        title="فیلتر کوپن‌ها"
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-coupon-filters__drawer-actions">
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
