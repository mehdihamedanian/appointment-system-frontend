"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/selection";
import { formatScheduleRange } from "@/lib/admin/schedule-target-backend";
import type { AdminScheduleTimeOffItem } from "@/types/admin-schedule";

export function ScheduleTimeOffPanel({
  items,
  disabled,
  deletingId,
  dayRangeOnly = false,
  timeZone,
  onCreate,
  onDelete,
}: {
  items: AdminScheduleTimeOffItem[];
  disabled?: boolean;
  deletingId?: string;
  /** Whole-day ranges only; no all-day switch or internal note. */
  dayRangeOnly?: boolean;
  timeZone?: string;
  onCreate: (body: {
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    reason?: string;
    note?: string;
  }) => void;
  onDelete: (timeOffId: string) => void;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const rangeInvalid = Boolean(startsAt && endsAt && endsAt < startsAt);
  const canSubmit = Boolean(startsAt && endsAt) && !rangeInvalid;

  function submit() {
    if (!canSubmit) return;
    onCreate({
      startsAt,
      endsAt,
      allDay: dayRangeOnly ? true : allDay,
      reason: reason.trim() || undefined,
      note: dayRangeOnly ? undefined : note || undefined,
    });
    setReason("");
    setNote("");
  }

  return (
    <section className="admin-schedule-panel" aria-labelledby="schedule-timeoff-title">
      <h3 id="schedule-timeoff-title" className="text-card-title">
        مرخصی / غیبت
      </h3>
      {dayRangeOnly ? (
        <p className="ds-help">بازه شامل کل روزهای انتخاب‌شده (از ابتدای روز شروع تا پایان روز آخر) است.</p>
      ) : null}

      {items.length === 0 ? <p className="ds-help">مرخصی ثبت نشده.</p> : null}
      <ul className="admin-schedule-list">
        {items.map((item) => (
          <li key={item.id} className="admin-schedule-list__item">
            <span>{formatScheduleRange(item.startsAt, item.endsAt, timeZone)}</span>
            {item.reason ? <span>{item.reason}</span> : null}
            <IconButton
              size="sm"
              label="حذف مرخصی"
              disabled={disabled || deletingId === item.id}
              onClick={() => onDelete(item.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </li>
        ))}
      </ul>

      {!disabled ? (
        <div className="admin-schedule-form-grid">
          <FormField id="timeoff-start" label="شروع">
            <DatePicker id="timeoff-start" value={startsAt || undefined} onChange={(value) => setStartsAt(value ?? "")} />
          </FormField>
          <FormField
            id="timeoff-end"
            label="پایان"
            error={rangeInvalid ? "تاریخ پایان نباید پیش از شروع باشد." : undefined}
          >
            <DatePicker id="timeoff-end" value={endsAt || undefined} onChange={(value) => setEndsAt(value ?? "")} />
          </FormField>
          {dayRangeOnly ? null : <Switch label="تمام‌روز" checked={allDay} onCheckedChange={setAllDay} />}
          <FormField id="timeoff-reason" label="دلیل">
            <Input id="timeoff-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          {dayRangeOnly ? null : (
            <FormField id="timeoff-note" label="یادداشت داخلی">
              <Input id="timeoff-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
          )}
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            ثبت مرخصی
          </Button>
        </div>
      ) : null}
    </section>
  );
}
