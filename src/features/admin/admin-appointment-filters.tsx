"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  ADMIN_APPOINTMENT_STATUS_FILTERS,
  ADMIN_APPOINTMENT_STATUS_LABELS,
  ADMIN_PAYMENT_STATUS_FILTERS,
  ADMIN_PAYMENT_STATUS_LABELS,
  ADMIN_SORT_LABELS,
  ADMIN_APPOINTMENT_SORT_FIELDS,
  type AdminAppointmentFilterOptions,
  type AdminAppointmentListFilters,
} from "@/types/admin-appointment";
import { sanitizeIsoDate } from "@/lib/admin/appointment-filters";

function FilterFields({
  filters,
  options,
  showResourceFilter,
  onChange,
}: {
  filters: AdminAppointmentListFilters;
  options?: AdminAppointmentFilterOptions;
  showResourceFilter?: boolean;
  onChange: (next: Partial<AdminAppointmentListFilters>) => void;
}) {
  const statusOptions = ADMIN_APPOINTMENT_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_APPOINTMENT_STATUS_LABELS[value],
  }));
  const paymentOptions = ADMIN_PAYMENT_STATUS_FILTERS.map((value) => ({
    value,
    label: ADMIN_PAYMENT_STATUS_LABELS[value],
  }));
  const sortOptions = ADMIN_APPOINTMENT_SORT_FIELDS.map((value) => ({
    value,
    label: ADMIN_SORT_LABELS[value],
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
  const staffOptions = useMemo(
    () => [
      { value: "all", label: "همه پرسنل" },
      ...(options?.staff?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.staff],
  );
  const resourceOptions = useMemo(
    () => [
      { value: "all", label: "همه منابع" },
      ...(options?.resources?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.resources],
  );
  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.name })) ?? []),
    ],
    [options?.branches],
  );
  const sourceOptions = useMemo(
    () => [
      { value: "all", label: "همه منابع رزرو" },
      ...(options?.bookingSources?.map((item) => ({ value: item.value, label: item.label })) ?? []),
    ],
    [options?.bookingSources],
  );

  return (
    <div className="admin-appointment-filters__grid">
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-date">تاریخ</Label>
        <input
          id="admin-appt-date"
          type="date"
          className="ds-control ltr-value"
          value={filters.date ?? ""}
          onChange={(event) => onChange({ date: sanitizeIsoDate(event.target.value), page: 1 })}
        />
      </div>
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-from">از</Label>
        <input
          id="admin-appt-from"
          type="date"
          className="ds-control ltr-value"
          value={filters.from ?? ""}
          onChange={(event) => onChange({ from: sanitizeIsoDate(event.target.value), page: 1 })}
        />
      </div>
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-to">تا</Label>
        <input
          id="admin-appt-to"
          type="date"
          className="ds-control ltr-value"
          value={filters.to ?? ""}
          onChange={(event) => onChange({ to: sanitizeIsoDate(event.target.value), page: 1 })}
        />
      </div>
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-status">وضعیت نوبت</Label>
        <Select
          id="admin-appt-status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) => onChange({ status: value ?? "all", page: 1 })}
        />
      </div>
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-payment">وضعیت پرداخت</Label>
        <Select
          id="admin-appt-payment"
          value={filters.paymentStatus}
          options={paymentOptions}
          onChange={(value) => onChange({ paymentStatus: value ?? "all", page: 1 })}
        />
      </div>
      {serviceOptions.length > 1 ? (
        <div className="admin-appointment-filters__field">
          <Label htmlFor="admin-appt-service">خدمت</Label>
          <Select
            id="admin-appt-service"
            value={filters.serviceId ?? "all"}
            options={serviceOptions}
            onChange={(value) =>
              onChange({ serviceId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {staffOptions.length > 1 ? (
        <div className="admin-appointment-filters__field">
          <Label htmlFor="admin-appt-staff">پرسنل</Label>
          <Select
            id="admin-appt-staff"
            value={filters.staffId ?? "all"}
            options={staffOptions}
            onChange={(value) =>
              onChange({ staffId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {showResourceFilter && resourceOptions.length > 1 ? (
        <div className="admin-appointment-filters__field">
          <Label htmlFor="admin-appt-resource">منبع</Label>
          <Select
            id="admin-appt-resource"
            value={filters.resourceId ?? "all"}
            options={resourceOptions}
            onChange={(value) =>
              onChange({ resourceId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {branchOptions.length > 1 ? (
        <div className="admin-appointment-filters__field">
          <Label htmlFor="admin-appt-branch">شعبه</Label>
          <Select
            id="admin-appt-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({ branchId: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      {sourceOptions.length > 1 ? (
        <div className="admin-appointment-filters__field">
          <Label htmlFor="admin-appt-source">منبع رزرو</Label>
          <Select
            id="admin-appt-source"
            value={filters.bookingSource ?? "all"}
            options={sourceOptions}
            onChange={(value) =>
              onChange({ bookingSource: value === "all" ? undefined : value, page: 1 })
            }
          />
        </div>
      ) : null}
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-sort">مرتب‌سازی</Label>
        <Select
          id="admin-appt-sort"
          value={filters.sort}
          options={sortOptions}
          onChange={(value) =>
            onChange({ sort: (value as AdminAppointmentListFilters["sort"]) ?? "startsAt", page: 1 })
          }
        />
      </div>
      <div className="admin-appointment-filters__field">
        <Label htmlFor="admin-appt-direction">جهت</Label>
        <Select
          id="admin-appt-direction"
          value={filters.direction}
          options={directionOptions}
          onChange={(value) =>
            onChange({
              direction: (value as AdminAppointmentListFilters["direction"]) ?? "desc",
              page: 1,
            })
          }
        />
      </div>
    </div>
  );
}

export function AdminAppointmentFilters({
  filters,
  options,
  activeCount,
  showResourceFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminAppointmentListFilters;
  options?: AdminAppointmentFilterOptions;
  activeCount: number;
  showResourceFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminAppointmentListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-appointment-filters admin-appointment-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showResourceFilter={showResourceFilter}
          onChange={onChange}
        />
        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            پاک کردن فیلترها ({activeCount})
          </Button>
        ) : null}
      </div>
      <div className="admin-appointment-filters admin-appointment-filters--mobile">
        <Button variant="secondary" onClick={() => onMobileOpenChange(true)}>
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>
      <Drawer
        open={mobileOpen}
        title="فیلتر نوبت‌ها"
        placement="bottom"
        onClose={() => onMobileOpenChange(false)}
      >
        <FilterFields
          filters={filters}
          options={options}
          showResourceFilter={showResourceFilter}
          onChange={(next) => {
            onChange(next);
          }}
        />
        <div className="admin-appointment-filters__drawer-actions">
          {activeCount > 0 ? (
            <Button variant="ghost" onClick={onClear}>
              پاک کردن
            </Button>
          ) : null}
          <Button onClick={() => onMobileOpenChange(false)}>اعمال</Button>
        </div>
      </Drawer>
    </>
  );
}
