"use client";

import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import type { AdminScheduleInheritanceMode, AdminScheduleScope } from "@/types/admin-schedule";
import { ADMIN_SCHEDULE_INHERITANCE_LABELS } from "@/types/admin-schedule";

const STAFF_RESOURCE_MODES: AdminScheduleInheritanceMode[] = [
  "inherit_business",
  "inherit_branch",
  "custom",
];

const BRANCH_MODES: AdminScheduleInheritanceMode[] = ["inherit_business", "custom"];

export function ScheduleInheritancePanel({
  scope,
  mode,
  disabled,
  onChange,
}: {
  scope: AdminScheduleScope;
  mode: AdminScheduleInheritanceMode;
  disabled?: boolean;
  onChange: (mode: AdminScheduleInheritanceMode) => void;
}) {
  const options =
    scope === "business"
      ? [{ value: "custom", label: ADMIN_SCHEDULE_INHERITANCE_LABELS.custom }]
      : scope === "branch"
        ? BRANCH_MODES.map((value) => ({
            value,
            label: ADMIN_SCHEDULE_INHERITANCE_LABELS[value as Exclude<AdminScheduleInheritanceMode, "unknown">],
          }))
        : STAFF_RESOURCE_MODES.map((value) => ({
            value,
            label: ADMIN_SCHEDULE_INHERITANCE_LABELS[value as Exclude<AdminScheduleInheritanceMode, "unknown">],
          }));

  if (scope === "business") {
    return (
      <p className="ds-help">
        ساعات کسب‌وکار پایهٔ وراثت برای شعب، کارکنان و منابع است.
      </p>
    );
  }

  return (
    <div className="admin-schedule-inheritance">
      <FormField id="schedule-inheritance-mode" label="حالت زمان‌بندی">
        <Select
          id="schedule-inheritance-mode"
          value={mode === "unknown" ? "custom" : mode}
          disabled={disabled}
          options={options.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(value) => onChange((value as AdminScheduleInheritanceMode) ?? "custom")}
        />
      </FormField>
      {mode !== "custom" ? (
        <p className="ds-help">
          در حالت وراثت، Backend برنامه مؤثر را محاسبه می‌کند. ویرایش هفتگی فقط در حالت سفارشی
          فعال است.
        </p>
      ) : null}
    </div>
  );
}
