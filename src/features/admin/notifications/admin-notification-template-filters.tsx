"use client";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  ADMIN_NOTIFICATION_CHANNEL_FILTERS,
  ADMIN_NOTIFICATION_EVENT_FILTERS,
  ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS,
  ADMIN_NOTIFICATION_EVENT_TYPE_LABELS,
  type AdminNotificationTemplateListFilters,
} from "@/types/admin-notification";

const CHANNEL_LABELS: Record<(typeof ADMIN_NOTIFICATION_CHANNEL_FILTERS)[number], string> = {
  all: "همه کانال‌ها",
  sms: "پیامک",
  email: "ایمیل",
};

const STATUS_LABELS: Record<(typeof ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS)[number], string> = {
  all: "همه وضعیت‌ها",
  enabled: "فعال",
  disabled: "غیرفعال",
  required: "الزامی",
};

function eventOptions() {
  return ADMIN_NOTIFICATION_EVENT_FILTERS.map((value) => ({
    value,
    label:
      value === "all"
        ? "همه رویدادها"
        : ADMIN_NOTIFICATION_EVENT_TYPE_LABELS[value as keyof typeof ADMIN_NOTIFICATION_EVENT_TYPE_LABELS] ?? value,
  }));
}

function FilterFields({
  filters,
  options,
  showBranch,
  onChange,
}: {
  filters: AdminNotificationTemplateListFilters;
  options?: AdminNotificationTemplateListFilters extends never
    ? never
    : {
        languages?: Array<{ id: string; label: string }>;
        branches?: Array<{ id: string; name: string }>;
      };
  showBranch: boolean;
  onChange: (next: Partial<AdminNotificationTemplateListFilters>) => void;
}) {
  return (
    <div className="admin-notification-filters__grid">
      <FormField id="nt-event" label="رویداد">
        <Select
          id="nt-event"
          value={filters.eventType}
          options={eventOptions()}
          onChange={(value) => value && onChange({ eventType: value as AdminNotificationTemplateListFilters["eventType"], page: 1 })}
        />
      </FormField>
      <FormField id="nt-channel" label="کانال">
        <Select
          id="nt-channel"
          value={filters.channel}
          options={ADMIN_NOTIFICATION_CHANNEL_FILTERS.map((value) => ({
            value,
            label: CHANNEL_LABELS[value],
          }))}
          onChange={(value) => value && onChange({ channel: value as AdminNotificationTemplateListFilters["channel"], page: 1 })}
        />
      </FormField>
      <FormField id="nt-status" label="وضعیت">
        <Select
          id="nt-status"
          value={filters.status}
          options={ADMIN_NOTIFICATION_TEMPLATE_STATUS_FILTERS.map((value) => ({
            value,
            label: STATUS_LABELS[value],
          }))}
          onChange={(value) => value && onChange({ status: value as AdminNotificationTemplateListFilters["status"], page: 1 })}
        />
      </FormField>
      {options?.languages?.length ? (
        <FormField id="nt-language" label="زبان">
          <Select
            id="nt-language"
            value={filters.language ?? ""}
            options={[
              { value: "", label: "همه زبان‌ها" },
              ...options.languages.map((item) => ({ value: item.id, label: item.label })),
            ]}
            onChange={(value) => onChange({ language: value || undefined, page: 1 })}
          />
        </FormField>
      ) : null}
      {showBranch && options?.branches?.length ? (
        <FormField id="nt-branch" label="شعبه">
          <Select
            id="nt-branch"
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

export function AdminNotificationTemplateFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminNotificationTemplateListFilters;
  options?: {
    languages?: Array<{ id: string; label: string }>;
    branches?: Array<{ id: string; name: string }>;
  };
  showBranchFilter: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminNotificationTemplateListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <section className="admin-notification-filters admin-notification-filters--desktop" aria-label="فیلتر قالب‌ها">
        <FilterFields filters={filters} options={options} showBranch={showBranchFilter} onChange={onChange} />
        <div className="admin-notification-filters__actions">
          <Button variant="secondary" size="sm" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
        </div>
      </section>

      <Drawer
        open={mobileOpen}
        title="فیلتر قالب‌ها"
        onClose={() => onMobileOpenChange(false)}
      >
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
