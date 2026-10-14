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
import type { AdminScheduleBlockItem, AdminScheduleScope } from "@/types/admin-schedule";

export function ScheduleBlockPanel({
  items,
  scope,
  disabled,
  deletingId,
  dayRangeOnly = false,
  timeZone,
  onCreate,
  onDelete,
}: {
  items: AdminScheduleBlockItem[];
  scope: AdminScheduleScope;
  disabled?: boolean;
  deletingId?: string;
  /** Whole-day ranges with a required reason; no all-day switch or internal note. */
  dayRangeOnly?: boolean;
  timeZone?: string;
  onCreate: (body: {
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    reason?: string;
    note?: string;
  }) => void;
  onDelete: (blockId: string) => void;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const trimmedReason = reason.trim();
  const rangeInvalid = Boolean(startsAt && endsAt && endsAt < startsAt);
  const canSubmit =
    Boolean(startsAt && endsAt) && !rangeInvalid && (!dayRangeOnly || trimmedReason.length > 0);

  function submit() {
    if (!canSubmit) return;
    onCreate({
      startsAt,
      endsAt,
      allDay: dayRangeOnly ? true : allDay,
      reason: trimmedReason || undefined,
      note: dayRangeOnly ? undefined : note || undefined,
    });
    setReason("");
    setNote("");
  }

  return (
    <section className="admin-schedule-panel" aria-labelledby="schedule-blocks-title">
      <h3 id="schedule-blocks-title" className="text-card-title">
        زمان مسدود
      </h3>
      <p className="ds-help">
        مسدودی عملیاتی — Backend در دسترس‌بودن را تعیین می‌کند. رفع مسدودی فقط همان رکورد را
        {dayRangeOnly ? " آزاد می‌کند و در سابقه باقی می‌ماند." : " حذف می‌کند."}
      </p>
      {dayRangeOnly ? (
        <p className="ds-help">بازه شامل کل روزهای انتخاب‌شده (از ابتدای روز شروع تا پایان روز آخر) است.</p>
      ) : null}

      {items.length === 0 ? <p className="ds-help">مسدودی ثبت نشده.</p> : null}
      <ul className="admin-schedule-list">
        {items.map((item) => (
          <li key={item.id} className="admin-schedule-list__item">
            <span>{formatScheduleRange(item.startsAt, item.endsAt, timeZone)}</span>
            {item.reason ? <span>{item.reason}</span> : null}
            <IconButton
              size="sm"
              label="رفع مسدودی"
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
          <FormField id="block-start" label="شروع">
            <DatePicker id="block-start" value={startsAt || undefined} onChange={(value) => setStartsAt(value ?? "")} />
          </FormField>
          <FormField
            id="block-end"
            label="پایان"
            error={rangeInvalid ? "تاریخ پایان نباید پیش از شروع باشد." : undefined}
          >
            <DatePicker id="block-end" value={endsAt || undefined} onChange={(value) => setEndsAt(value ?? "")} />
          </FormField>
          {dayRangeOnly ? null : <Switch label="تمام‌روز" checked={allDay} onCheckedChange={setAllDay} />}
          <FormField id="block-reason" label="دلیل" required={dayRangeOnly}>
            <Input
              id="block-reason"
              value={reason}
              required={dayRangeOnly}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          {dayRangeOnly ? null : (
            <FormField id="block-note" label="یادداشت داخلی">
              <Input id="block-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
          )}
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            ثبت مسدودی ({scope})
          </Button>
        </div>
      ) : null}
    </section>
  );
}
