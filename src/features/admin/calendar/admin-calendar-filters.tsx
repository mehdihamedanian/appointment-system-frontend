"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_APPOINTMENT_STATUS_LABELS,
  ADMIN_PAYMENT_STATUS_LABELS,
  type AdminAppointmentStatusFilter,
  type AdminPaymentStatusFilter,
} from "@/types/admin-appointment";
import type { AdminCalendarFilterOptions, AdminCalendarState } from "@/types/admin-calendar";

export function AdminCalendarFiltersDrawer({
  open,
  onClose,
  state,
  options,
  showBranch,
  showResources,
  onChange,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  state: AdminCalendarState;
  options?: AdminCalendarFilterOptions;
  showBranch: boolean;
  showResources: boolean;
  onChange: (patch: Partial<AdminCalendarState>) => void;
  onClear: () => void;
}) {
  const statusOptions = Object.entries(ADMIN_APPOINTMENT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const paymentOptions = Object.entries(ADMIN_PAYMENT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Drawer open={open} onClose={onClose} title="فیلترهای تقویم" placement="bottom">
      <div className="admin-calendar-filters">
        {showBranch ? (
          <FormField id="cal-branch" label="شعبه">
            <Select
              id="cal-branch"
              value={state.branchId}
              allowClear
              placeholder="همه شعب"
              options={(options?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              onChange={(value) => onChange({ branchId: value, staffId: undefined, resourceId: undefined })}
            />
          </FormField>
        ) : null}
        <FormField id="cal-staff" label="کارمند">
          <Select
            id="cal-staff"
            value={state.staffId}
            allowClear
            placeholder="همه کارکنان"
            options={(options?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(value) => onChange({ staffId: value })}
          />
        </FormField>
        {showResources ? (
          <>
            <FormField id="cal-resource-type" label="نوع منبع">
              <Select
                id="cal-resource-type"
                value={state.resourceType}
                allowClear
                placeholder="همه انواع"
                options={(options?.resourceTypes ?? []).map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                onChange={(value) => onChange({ resourceType: value, resourceId: undefined })}
              />
            </FormField>
            <FormField id="cal-resource" label="منبع">
              <Select
                id="cal-resource"
                value={state.resourceId}
                allowClear
                placeholder="همه منابع"
                options={(options?.resources ?? [])
                  .filter((r) => !state.resourceType || r.type === state.resourceType)
                  .map((r) => ({ value: r.id, label: r.name }))}
                onChange={(value) => onChange({ resourceId: value })}
              />
            </FormField>
          </>
        ) : null}
        <FormField id="cal-service" label="خدمت">
          <Select
            id="cal-service"
            value={state.serviceId}
            allowClear
            placeholder="همه خدمات"
            options={(options?.services ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(value) => onChange({ serviceId: value })}
          />
        </FormField>
        <FormField id="cal-status" label="وضعیت نوبت">
          <Select
            id="cal-status"
            value={state.status}
            options={statusOptions}
            onChange={(value) =>
              onChange({ status: (value as AdminAppointmentStatusFilter) ?? "all" })
            }
          />
        </FormField>
        <FormField id="cal-payment" label="وضعیت پرداخت">
          <Select
            id="cal-payment"
            value={state.paymentStatus}
            options={paymentOptions}
            onChange={(value) =>
              onChange({
                paymentStatus: (value as AdminPaymentStatusFilter) ?? "all",
              })
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
