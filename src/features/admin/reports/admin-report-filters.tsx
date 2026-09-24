"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { sanitizeIsoDate } from "@/lib/admin/dashboard-filters";
import { REPORT_SUPPORTED_FILTERS } from "@/lib/admin/report-filters";
import {
  ADMIN_REPORT_COMPARISON_MODE_LABELS,
  ADMIN_REPORT_COMPARISON_MODES,
  ADMIN_REPORT_DATE_PRESET_LABELS,
  ADMIN_REPORT_DATE_PRESETS,
  type AdminReportComparisonMode,
  type AdminReportDatePreset,
  type AdminReportFilterOptions,
  type AdminReportListFilters,
} from "@/types/admin-report";

function supports(
  filters: AdminReportListFilters,
  key: keyof AdminReportListFilters,
): boolean {
  return REPORT_SUPPORTED_FILTERS[filters.report].includes(key);
}

function FilterFields({
  filters,
  options,
  showBranchFilter,
  onChange,
}: {
  filters: AdminReportListFilters;
  options?: AdminReportFilterOptions;
  showBranchFilter?: boolean;
  onChange: (next: Partial<AdminReportListFilters>) => void;
}) {
  const presets = (options?.presets?.length ? options.presets : ADMIN_REPORT_DATE_PRESETS).map(
    (value) => ({
      value,
      label: ADMIN_REPORT_DATE_PRESET_LABELS[value],
    }),
  );
  const comparisons = (
    options?.comparisonModes?.length ? options.comparisonModes : ADMIN_REPORT_COMPARISON_MODES
  ).map((value) => ({
    value,
    label: ADMIN_REPORT_COMPARISON_MODE_LABELS[value],
  }));

  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.branches],
  );
  const serviceOptions = useMemo(
    () => [
      { value: "all", label: "همه خدمات" },
      ...(options?.services?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.services],
  );
  const staffOptions = useMemo(
    () => [
      { value: "all", label: "همه پرسنل" },
      ...(options?.staff?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.staff],
  );
  const resourceOptions = useMemo(
    () => [
      { value: "all", label: "همه منابع" },
      ...(options?.resources?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.resources],
  );
  const resourceTypeOptions = useMemo(
    () => [
      { value: "all", label: "همه انواع" },
      ...(options?.resourceTypes?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.resourceTypes],
  );
  const appointmentStatusOptions = useMemo(
    () => [
      { value: "all", label: "همه وضعیت‌ها" },
      ...(options?.appointmentStatuses?.map((item) => ({ value: item.id, label: item.label })) ??
        []),
    ],
    [options?.appointmentStatuses],
  );
  const paymentStatusOptions = useMemo(
    () => [
      { value: "all", label: "همه وضعیت‌ها" },
      ...(options?.paymentStatuses?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.paymentStatuses],
  );

  return (
    <div className="admin-report-filters__grid">
      <div className="admin-report-filters__field">
        <Label htmlFor="admin-report-preset">بازه زمانی</Label>
        <Select
          id="admin-report-preset"
          value={filters.preset}
          options={presets}
          onChange={(value) =>
            onChange({
              preset: (value as AdminReportDatePreset) ?? "last_30_days",
              from: value === "custom" ? filters.from : undefined,
              to: value === "custom" ? filters.to : undefined,
            })
          }
          allowClear={false}
        />
      </div>

      {filters.preset === "custom" ? (
        <>
          <div className="admin-report-filters__field">
            <Label htmlFor="admin-report-from">از تاریخ</Label>
            <input
              id="admin-report-from"
              type="date"
              className="ds-control ltr-value"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ from: sanitizeIsoDate(event.target.value) })}
            />
          </div>
          <div className="admin-report-filters__field">
            <Label htmlFor="admin-report-to">تا تاریخ</Label>
            <input
              id="admin-report-to"
              type="date"
              className="ds-control ltr-value"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ to: sanitizeIsoDate(event.target.value) })}
            />
          </div>
        </>
      ) : null}

      {supports(filters, "comparison") ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-comparison">مقایسه</Label>
          <Select
            id="admin-report-comparison"
            value={filters.comparison}
            options={comparisons}
            onChange={(value) =>
              onChange({
                comparison: (value as AdminReportComparisonMode) ?? "none",
                compareFrom: value === "custom" ? filters.compareFrom : undefined,
                compareTo: value === "custom" ? filters.compareTo : undefined,
              })
            }
            allowClear={false}
          />
        </div>
      ) : null}

      {filters.comparison === "custom" ? (
        <>
          <div className="admin-report-filters__field">
            <Label htmlFor="admin-report-compare-from">مقایسه از</Label>
            <input
              id="admin-report-compare-from"
              type="date"
              className="ds-control ltr-value"
              value={filters.compareFrom ?? ""}
              onChange={(event) =>
                onChange({ compareFrom: sanitizeIsoDate(event.target.value) })
              }
            />
          </div>
          <div className="admin-report-filters__field">
            <Label htmlFor="admin-report-compare-to">مقایسه تا</Label>
            <input
              id="admin-report-compare-to"
              type="date"
              className="ds-control ltr-value"
              value={filters.compareTo ?? ""}
              onChange={(event) => onChange({ compareTo: sanitizeIsoDate(event.target.value) })}
            />
          </div>
        </>
      ) : null}

      {showBranchFilter && supports(filters, "branchId") ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-branch">شعبه</Label>
          <Select
            id="admin-report-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({ branchId: value === "all" ? undefined : value ?? undefined })
            }
          />
        </div>
      ) : null}

      {supports(filters, "serviceId") && (options?.services?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-service">خدمت</Label>
          <Select
            id="admin-report-service"
            value={filters.serviceId ?? "all"}
            options={serviceOptions}
            onChange={(value) =>
              onChange({ serviceId: value === "all" ? undefined : value ?? undefined })
            }
          />
        </div>
      ) : null}

      {supports(filters, "staffId") && (options?.staff?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-staff">پرسنل</Label>
          <Select
            id="admin-report-staff"
            value={filters.staffId ?? "all"}
            options={staffOptions}
            onChange={(value) =>
              onChange({ staffId: value === "all" ? undefined : value ?? undefined })
            }
          />
        </div>
      ) : null}

      {supports(filters, "resourceType") && (options?.resourceTypes?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-resource-type">نوع منبع</Label>
          <Select
            id="admin-report-resource-type"
            value={filters.resourceType ?? "all"}
            options={resourceTypeOptions}
            onChange={(value) =>
              onChange({
                resourceType: value === "all" ? undefined : value ?? undefined,
                resourceId: undefined,
              })
            }
          />
        </div>
      ) : null}

      {supports(filters, "resourceId") && (options?.resources?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-resource">منبع</Label>
          <Select
            id="admin-report-resource"
            value={filters.resourceId ?? "all"}
            options={resourceOptions}
            onChange={(value) =>
              onChange({ resourceId: value === "all" ? undefined : value ?? undefined })
            }
          />
        </div>
      ) : null}

      {supports(filters, "appointmentStatus") &&
      (options?.appointmentStatuses?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-appointment-status">وضعیت نوبت</Label>
          <Select
            id="admin-report-appointment-status"
            value={filters.appointmentStatus ?? "all"}
            options={appointmentStatusOptions}
            onChange={(value) =>
              onChange({
                appointmentStatus: value === "all" ? undefined : value ?? undefined,
              })
            }
          />
        </div>
      ) : null}

      {supports(filters, "paymentStatus") && (options?.paymentStatuses?.length ?? 0) > 0 ? (
        <div className="admin-report-filters__field">
          <Label htmlFor="admin-report-payment-status">وضعیت پرداخت</Label>
          <Select
            id="admin-report-payment-status"
            value={filters.paymentStatus ?? "all"}
            options={paymentStatusOptions}
            onChange={(value) =>
              onChange({ paymentStatus: value === "all" ? undefined : value ?? undefined })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export function AdminReportFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminReportListFilters;
  options?: AdminReportFilterOptions;
  showBranchFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminReportListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-report-filters admin-report-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-report-filters__actions">
          <Button variant="secondary" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        title="فیلتر گزارش"
        placement="bottom"
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-report-filters__drawer-actions">
          <Button variant="secondary" onClick={onClear}>
            پاک کردن
          </Button>
          <Button onClick={() => onMobileOpenChange(false)}>اعمال</Button>
        </div>
      </Drawer>
    </>
  );
}
