"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ADMIN_NOTIFICATION_CHANNEL_FILTERS,
  ADMIN_NOTIFICATION_EVENT_FILTERS,
  ADMIN_NOTIFICATION_LOG_STATUS_FILTERS,
  ADMIN_NOTIFICATION_EVENT_TYPE_LABELS,
  ADMIN_NOTIFICATION_DELIVERY_STATUS_LABELS,
  type AdminNotificationLogListFilters,
} from "@/types/admin-notification";

const CHANNEL_LABELS = { all: "همه کانال‌ها", sms: "پیامک", email: "ایمیل" } as const;

function FilterFields({
  filters,
  options,
  showBranch,
  onChange,
}: {
  filters: AdminNotificationLogListFilters;
  options?: {
    branches?: Array<{ id: string; name: string }>;
    templates?: Array<{ id: string; label: string }>;
  };
  showBranch: boolean;
  onChange: (next: Partial<AdminNotificationLogListFilters>) => void;
}) {
  return (
    <div className="admin-notification-filters__grid">
      <FormField id="nl-event" label="رویداد">
        <Select
          id="nl-event"
          value={filters.eventType}
          options={ADMIN_NOTIFICATION_EVENT_FILTERS.map((value) => ({
            value,
            label:
              value === "all"
                ? "همه رویدادها"
                : ADMIN_NOTIFICATION_EVENT_TYPE_LABELS[value as keyof typeof ADMIN_NOTIFICATION_EVENT_TYPE_LABELS] ?? value,
          }))}
          onChange={(value) => value && onChange({ eventType: value as AdminNotificationLogListFilters["eventType"], page: 1 })}
        />
      </FormField>
      <FormField id="nl-channel" label="کانال">
        <Select
          id="nl-channel"
          value={filters.channel}
          options={ADMIN_NOTIFICATION_CHANNEL_FILTERS.map((value) => ({
            value,
            label: CHANNEL_LABELS[value],
          }))}
          onChange={(value) => value && onChange({ channel: value as AdminNotificationLogListFilters["channel"], page: 1 })}
        />
      </FormField>
      <FormField id="nl-status" label="وضعیت ارسال">
        <Select
          id="nl-status"
          value={filters.status}
          options={ADMIN_NOTIFICATION_LOG_STATUS_FILTERS.map((value) => ({
            value,
            label: value === "all" ? "همه وضعیت‌ها" : ADMIN_NOTIFICATION_DELIVERY_STATUS_LABELS[value],
          }))}
          onChange={(value) => value && onChange({ status: value as AdminNotificationLogListFilters["status"], page: 1 })}
        />
      </FormField>
      <FormField id="nl-from" label="از تاریخ" optional>
        <Input
          id="nl-from"
          type="date"
          value={filters.from ?? ""}
          onChange={(event) => onChange({ from: event.target.value || undefined, page: 1 })}
        />
      </FormField>
      <FormField id="nl-to" label="تا تاریخ" optional>
        <Input
          id="nl-to"
          type="date"
          value={filters.to ?? ""}
          onChange={(event) => onChange({ to: event.target.value || undefined, page: 1 })}
        />
      </FormField>
      {options?.templates?.length ? (
        <FormField id="nl-template" label="قالب" optional>
          <Select
            id="nl-template"
            value={filters.templateReference ?? ""}
            options={[
              { value: "", label: "همه قالب‌ها" },
              ...options.templates.map((item) => ({ value: item.id, label: item.label })),
            ]}
            onChange={(value) => onChange({ templateReference: value || undefined, page: 1 })}
          />
        </FormField>
      ) : null}
      {showBranch && options?.branches?.length ? (
        <FormField id="nl-branch" label="شعبه" optional>
          <Select
            id="nl-branch"
            value={filters.branchId ?? ""}
            options={[
              { value: "", label: "همه شعب" },
              ...options.branches.map((item) => ({ value: item.id, label: item.name })),
            ]}
            onChange={(value) => onChange({ branchId: value || undefined, page: 1 })}
          />
        </FormField>
      ) : null}
    </div>
  );
}

export function AdminNotificationLogFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminNotificationLogListFilters;
  options?: {
    branches?: Array<{ id: string; name: string }>;
    templates?: Array<{ id: string; label: string }>;
  };
  showBranchFilter: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminNotificationLogListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <section className="admin-notification-filters admin-notification-filters--desktop" aria-label="فیلتر گزارش ارسال">
        <FilterFields filters={filters} options={options} showBranch={showBranchFilter} onChange={onChange} />
        <div className="admin-notification-filters__actions">
          <Button variant="secondary" size="sm" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
        </div>
      </section>
      <Drawer open={mobileOpen} title="فیلتر گزارش" onClose={() => onMobileOpenChange(false)}>
        <FilterFields filters={filters} options={options} showBranch={showBranchFilter} onChange={onChange} />
        <div className="admin-notification-filters__drawer-actions">
          <Button variant="secondary" onClick={onClear}>
            پاک کردن
          </Button>
          <Button onClick={() => onMobileOpenChange(false)}>اعمال</Button>
        </div>
      </Drawer>
    </>
  );
}
