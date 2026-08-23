"use client";

import { Radio, RadioGroup } from "@/components/ui/selection";
import { Skeleton } from "@/components/feedback/loading-states";
import { groupSlotsByPeriod } from "@/lib/availability/grouping";
import type { AvailableSlotView } from "@/types/availability";

export function SlotPicker({
  slots,
  selectedId,
  onSelect,
  timezone,
  submitted,
  refreshing,
  loading,
}: {
  slots: AvailableSlotView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  timezone?: string;
  submitted?: boolean;
  refreshing?: boolean;
  loading?: boolean;
}) {
  const groups = groupSlotsByPeriod(slots, timezone);
  const visible = groups.length > 0 ? groups : [{ period: "morning" as const, label: "ساعت‌ها", slots }];

  if (loading) {
    return (
      <div className="booking-slot-skeleton" aria-busy="true" aria-label="در حال بارگذاری ساعت‌ها">
        <Skeleton variant="line" />
        <div className="booking-slot-grid">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <RadioGroup
      legend="انتخاب ساعت"
      description={refreshing ? "در حال به‌روزرسانی ساعت‌ها" : undefined}
      error={submitted && !selectedId ? "لطفاً یک ساعت را انتخاب کنید." : undefined}
    >
      <div className="booking-slot-groups">
        {visible.map((group) => (
          <section key={group.period} className="booking-slot-group" aria-labelledby={`slot-group-${group.period}`}>
            <h3 id={`slot-group-${group.period}`} className="text-caption">
              {group.label}
            </h3>
            <div className="booking-slot-grid">
              {group.slots.map((slot) => {
                const disabled = slot.status !== "available";
                const selected = selectedId === slot.id;
                const statusLabel =
                  slot.status === "held"
                    ? "در حال نگهداری"
                    : slot.status === "unavailable"
                      ? "دیگر در دسترس نیست"
                      : selected
                        ? "انتخاب‌شده"
                        : "قابل رزرو";
                return (
                  <Radio
                    key={slot.id}
                    name="booking-slot"
                    value={slot.id}
                    checked={selected}
                    disabled={disabled}
                    className={`booking-option booking-slot${slot.status !== "available" ? ` booking-slot--${slot.status}` : ""}`}
                    onChange={() => {
                      if (!disabled) {
                        onSelect(slot.id);
                      }
                    }}
                    label={
                      <span>
                        <strong className="ltr-value">{slot.label}</strong>
                        {selected ? " — انتخاب‌شده" : ""}
                        {disabled ? ` — ${statusLabel}` : ""}
                      </span>
                    }
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </RadioGroup>
  );
}
