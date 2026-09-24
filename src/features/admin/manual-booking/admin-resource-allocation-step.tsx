"use client";

import { Checkbox, Radio, RadioGroup } from "@/components/ui/selection";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import type { AdminResourceAllocationView } from "@/types/admin-manual-booking";

export function AdminResourceAllocationStep({
  allocation,
  loading,
  error,
  onRetry,
  mode,
  selections,
  onModeChange,
  onSelectionChange,
  submitted,
  canViewResources,
}: {
  allocation?: AdminResourceAllocationView;
  loading?: boolean;
  error?: { message: string; requestId?: string };
  onRetry?: () => void;
  mode: "automatic" | "select" | "override";
  selections: Record<string, string[]>;
  onModeChange: (mode: "automatic" | "select" | "override") => void;
  onSelectionChange: (groupId: string, resourceIds: string[]) => void;
  submitted?: boolean;
  canViewResources: boolean;
}) {
  if (!canViewResources) {
    return (
      <EmptyState
        title="تخصیص منابع"
        description="منابع به‌صورت خودکار توسط سرویس تخصیص داده می‌شود."
      />
    );
  }

  if (loading) {
    return <Skeleton variant="card" aria-label="در حال بارگذاری تخصیص منابع" />;
  }

  if (error) {
    return (
      <ApiErrorState
        title="تخصیص منابع دریافت نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={onRetry}
      />
    );
  }

  if (allocation?.unavailableReason === "missing_endpoint") {
    return (
      <EmptyState
        title="تخصیص منابع هنوز متصل نشده"
        description="سرویس باید منابع معتبر را اعلام کند. تخصیص در مرورگر محاسبه نمی‌شود."
      />
    );
  }

  if (allocation?.unavailableReason === "not_required" || allocation?.groups.length === 0) {
    return (
      <section aria-labelledby="allocation-auto-title">
        <h2 id="allocation-auto-title" className="text-card-title">
          تخصیص خودکار
        </h2>
        <p className="ds-help">
          {allocation?.automaticSummary ??
            "برای این نوبت تخصیص دستی منبع لازم نیست. سرویس منابع را خودکار تعیین می‌کند."}
        </p>
      </section>
    );
  }

  const canOverride = allocation?.canOverride === true;

  return (
    <section className="admin-resource-allocation-step" aria-labelledby="allocation-title">
      <h2 id="allocation-title" className="text-card-title">
        تخصیص منابع
      </h2>
      {submitted && mode !== "automatic" && Object.values(selections).every((ids) => ids.length === 0) ? (
        <p className="ds-error" role="alert">
          لطفاً منابع لازم را انتخاب کنید.
        </p>
      ) : null}
      <RadioGroup legend="حالت تخصیص" orientation="vertical">
        <Radio
          name="allocation-mode"
          value="automatic"
          checked={mode === "automatic"}
          onChange={() => onModeChange("automatic")}
          label="تخصیص خودکار"
          description="سرویس منابع مناسب را پیشنهاد و تخصیص می‌دهد."
        />
        {allocation?.mode === "select" || allocation?.groups.some((group) => group.mode === "select") ? (
          <Radio
            name="allocation-mode"
            value="select"
            checked={mode === "select"}
            onChange={() => onModeChange("select")}
            label="انتخاب از منابع معتبر"
            description="فقط منابع برگشتی از سرویس قابل انتخاب هستند."
          />
        ) : null}
        {canOverride ? (
          <Radio
            name="allocation-mode"
            value="override"
            checked={mode === "override"}
            onChange={() => onModeChange("override")}
            label="تغییر دستی (نیازمند مجوز)"
            description="تغییر دستی دوباره توسط سرویس اعتبارسنجی می‌شود."
          />
        ) : null}
      </RadioGroup>
      {mode === "automatic" ? (
        <p className="ds-help" role="status">
          {allocation?.automaticSummary ?? "خلاصه تخصیص پس از استعلام نهایی نمایش داده می‌شود."}
        </p>
      ) : (
        allocation?.groups.map((group) => (
          <fieldset key={group.id} className="admin-resource-group">
            <legend>{group.label}</legend>
            <div className="admin-resource-options">
              {group.items.map((item) => {
                const selected = selections[group.id]?.includes(item.id) ?? false;
                return (
                  <Checkbox
                    key={item.id}
                    name={`resource-${group.id}`}
                    checked={selected}
                    onChange={() => {
                      const current = selections[group.id] ?? [];
                      const next = selected
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id];
                      onSelectionChange(group.id, next);
                    }}
                    label={item.name}
                    description={item.required ? "الزامی" : undefined}
                  />
                );
              })}
            </div>
          </fieldset>
        ))
      )}
      {loading ? <InlineLoading label="در حال به‌روزرسانی تخصیص" /> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          به‌روزرسانی تخصیص
        </Button>
      ) : null}
    </section>
  );
}
