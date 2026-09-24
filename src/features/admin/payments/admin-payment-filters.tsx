"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { sanitizeIsoDate } from "@/lib/customer/payment-history-filters";
import {
  ADMIN_PAYMENT_METHOD_FILTERS,
  ADMIN_PAYMENT_METHOD_LABELS,
  ADMIN_PAYMENT_REFUND_STATUS_FILTERS,
  ADMIN_PAYMENT_REFUND_STATUS_LABELS,
  ADMIN_PAYMENT_SORT_FIELDS,
  ADMIN_PAYMENT_SORT_LABELS,
  type AdminPaymentFilterOptions,
  type AdminPaymentListFilters,
} from "@/types/admin-payment";
import {
  PAYMENT_HISTORY_STATUS_FILTERS,
  PAYMENT_HISTORY_STATUS_LABELS,
} from "@/types/payment-history";

function FilterFields({
  filters,
  options,
  showBranchFilter,
  onChange,
}: {
  filters: AdminPaymentListFilters;
  options?: AdminPaymentFilterOptions;
  showBranchFilter?: boolean;
  onChange: (next: Partial<AdminPaymentListFilters>) => void;
}) {
  const statusOptions = PAYMENT_HISTORY_STATUS_FILTERS.map((value) => ({
    value,
    label: PAYMENT_HISTORY_STATUS_LABELS[value],
  }));
  const refundOptions = ADMIN_PAYMENT_REFUND_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_PAYMENT_REFUND_STATUS_LABELS[value],
  }));
  const methodOptions =
    options?.methods?.length ?
      [
        { value: "all", label: "همه روش‌ها" },
        ...options.methods.map((item) => ({ value: item.id, label: item.label })),
      ]
    : ADMIN_PAYMENT_METHOD_FILTERS.map((value) => ({
        value,
        label: ADMIN_PAYMENT_METHOD_LABELS[value],
      }));
  const sortOptions = ADMIN_PAYMENT_SORT_FIELDS.map((value) => ({
    value,
    label: ADMIN_PAYMENT_SORT_LABELS[value],
  }));
  const directionOptions = [
    { value: "desc", label: "نزولی" },
    { value: "asc", label: "صعودی" },
  ];
  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.branches],
  );

  return (
    <div className="admin-payment-filters__grid">
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-status">وضعیت پرداخت</Label>
        <Select
          id="admin-payment-status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) =>
            onChange({ status: (value as AdminPaymentListFilters["status"]) ?? "all", page: 1 })
          }
        />
      </div>
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-refund">وضعیت بازپرداخت</Label>
        <Select
          id="admin-payment-refund"
          value={filters.refundStatus}
          options={refundOptions}
          onChange={(value) =>
            onChange({
              refundStatus: (value as AdminPaymentListFilters["refundStatus"]) ?? "all",
              page: 1,
            })
          }
        />
      </div>
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-method">روش پرداخت</Label>
        <Select
          id="admin-payment-method"
          value={filters.method}
          options={methodOptions}
          onChange={(value) =>
            onChange({ method: (value as AdminPaymentListFilters["method"]) ?? "all", page: 1 })
          }
        />
      </div>
      {showBranchFilter ? (
        <div className="admin-payment-filters__field">
          <Label htmlFor="admin-payment-branch">شعبه</Label>
          <Select
            id="admin-payment-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({ branchId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-from">از تاریخ</Label>
        <input
          id="admin-payment-from"
          type="date"
          className="ds-control ltr-value"
          value={filters.from ?? ""}
          onChange={(event) => onChange({ from: sanitizeIsoDate(event.target.value), page: 1 })}
        />
      </div>
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-to">تا تاریخ</Label>
        <input
          id="admin-payment-to"
          type="date"
          className="ds-control ltr-value"
          value={filters.to ?? ""}
          onChange={(event) => onChange({ to: sanitizeIsoDate(event.target.value), page: 1 })}
        />
      </div>
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-sort">مرتب‌سازی</Label>
        <Select
          id="admin-payment-sort"
          value={filters.sort}
          options={sortOptions}
          onChange={(value) =>
            onChange({ sort: (value as AdminPaymentListFilters["sort"]) ?? "createdAt", page: 1 })
          }
        />
      </div>
      <div className="admin-payment-filters__field">
        <Label htmlFor="admin-payment-direction">جهت</Label>
        <Select
          id="admin-payment-direction"
          value={filters.direction}
          options={directionOptions}
          onChange={(value) =>
            onChange({
              direction: (value as AdminPaymentListFilters["direction"]) ?? "desc",
              page: 1,
            })
          }
        />
      </div>
    </div>
  );
}

export function AdminPaymentFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminPaymentListFilters;
  options?: AdminPaymentFilterOptions;
  showBranchFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminPaymentListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-payment-filters admin-payment-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <Button variant="ghost" onClick={onClear}>
          پاک کردن فیلترها
        </Button>
      </div>
      <Drawer
        open={mobileOpen}
        title="فیلتر پرداخت‌ها"
        placement="bottom"
        onClose={() => onMobileOpenChange(false)}
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-payment-filters__drawer-actions">
          <Button variant="ghost" onClick={onClear}>
            پاک کردن
          </Button>
          <Button onClick={() => onMobileOpenChange(false)}>اعمال</Button>
        </div>
      </Drawer>
    </>
  );
}
