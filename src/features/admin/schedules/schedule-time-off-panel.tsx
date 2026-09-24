"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/selection";
import type { AdminScheduleTimeOffItem } from "@/types/admin-schedule";

export function ScheduleTimeOffPanel({
  items,
  disabled,
  deletingId,
  onCreate,
  onDelete,
}: {
  items: AdminScheduleTimeOffItem[];
  disabled?: boolean;
  deletingId?: string;
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

  function submit() {
    if (!startsAt || !endsAt) return;
    onCreate({ startsAt, endsAt, allDay, reason: reason || undefined, note: note || undefined });
    setReason("");
    setNote("");
  }

  return (
    <section className="admin-schedule-panel" aria-labelledby="schedule-timeoff-title">
      <h3 id="schedule-timeoff-title" className="text-card-title">
        مرخصی / غیبت
      </h3>

      {items.length === 0 ? <p className="ds-help">مرخصی ثبت نشده.</p> : null}
      <ul className="admin-schedule-list">
        {items.map((item) => (
          <li key={item.id} className="admin-schedule-list__item">
            <span className="ltr-value">
              {item.startsAt} — {item.endsAt}
            </span>
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
          <FormField id="timeoff-end" label="پایان">
            <DatePicker id="timeoff-end" value={endsAt || undefined} onChange={(value) => setEndsAt(value ?? "")} />
          </FormField>
          <Switch label="تمام‌روز" checked={allDay} onCheckedChange={setAllDay} />
          <FormField id="timeoff-reason" label="دلیل">
            <Input id="timeoff-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <FormField id="timeoff-note" label="یادداشت داخلی">
            <Input id="timeoff-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <Button type="button" disabled={!startsAt || !endsAt} onClick={submit}>
            ثبت مرخصی
          </Button>
        </div>
      ) : null}
    </section>
  );
}
