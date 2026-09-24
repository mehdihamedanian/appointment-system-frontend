"use client";

import { useMemo, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/selection";
import { ScheduleWeekDayEditor } from "@/features/admin/schedules/schedule-week-day-editor";
import type { AdminScheduleValidationIssue } from "@/lib/admin/schedule-adapter";
import { createEmptyWeekdayDraft } from "@/lib/admin/schedule-adapter";
import type { AdminScheduleWeekdayDraft } from "@/types/admin-schedule";
import { WEEKDAY_INDICES } from "@/types/admin-schedule";

export function ScheduleWeeklyEditor({
  weekly,
  disabled,
  supportsBreaks,
  supportsCopyDay,
  issues,
  onChange,
}: {
  weekly: AdminScheduleWeekdayDraft[];
  disabled?: boolean;
  supportsBreaks?: boolean;
  supportsCopyDay?: boolean;
  issues: AdminScheduleValidationIssue[];
  onChange: (next: AdminScheduleWeekdayDraft[]) => void;
}) {
  const [copySource, setCopySource] = useState<number>(WEEKDAY_INDICES[0]);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  const byWeekday = useMemo(() => {
    const map = new Map<number, AdminScheduleWeekdayDraft>();
    for (const day of weekly) {
      map.set(day.weekday, day);
    }
    return WEEKDAY_INDICES.map((weekday) => map.get(weekday) ?? createEmptyWeekdayDraft(weekday));
  }, [weekly]);

  function updateDay(nextDay: AdminScheduleWeekdayDraft) {
    onChange(byWeekday.map((day) => (day.weekday === nextDay.weekday ? nextDay : day)));
  }

  function clearDay(weekday: number) {
    onChange(byWeekday.map((day) => (day.weekday === weekday ? createEmptyWeekdayDraft(weekday) : day)));
  }

  function applyCopy() {
    const source = byWeekday.find((day) => day.weekday === copySource);
    if (!source || copyTargets.length === 0) return;
    onChange(
      byWeekday.map((day) => {
        if (!copyTargets.includes(day.weekday)) return day;
        return {
          ...source,
          weekday: day.weekday,
          label: day.label,
          intervals: source.intervals.map((interval) => ({
            ...interval,
            id: `cpy_${day.weekday}_${interval.id}`,
          })),
          breaks: source.breaks.map((brk) => ({
            ...brk,
            id: `cpy_${day.weekday}_${brk.id}`,
          })),
        };
      }),
    );
  }

  const accordionItems = byWeekday.map((day) => ({
    id: `day-${day.weekday}`,
    title: day.label,
    content: (
      <ScheduleWeekDayEditor
        day={day}
        disabled={disabled}
        supportsBreaks={supportsBreaks}
        issues={issues}
        onChange={updateDay}
      />
    ),
  }));

  return (
    <div className="admin-schedule-weekly">
      {supportsCopyDay !== false ? (
        <div className="admin-schedule-copy">
          <p className="text-card-title">کپی روز</p>
          <div className="admin-schedule-copy__controls">
            <label className="ds-field">
              <span>از</span>
              <select
                className="ds-select"
                value={copySource}
                disabled={disabled}
                onChange={(event) => setCopySource(Number(event.target.value))}
              >
                {byWeekday.map((day) => (
                  <option key={day.weekday} value={day.weekday}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="admin-schedule-copy__targets">
              <legend>به</legend>
              {byWeekday.map((day) => (
                <Checkbox
                  key={day.weekday}
                  label={day.label}
                  checked={copyTargets.includes(day.weekday)}
                  disabled={disabled || day.weekday === copySource}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setCopyTargets((current) =>
                      checked
                        ? [...current, day.weekday]
                        : current.filter((value) => value !== day.weekday),
                    );
                  }}
                />
              ))}
            </fieldset>
            <Button type="button" variant="secondary" size="sm" disabled={disabled || copyTargets.length === 0} onClick={applyCopy}>
              اعمال کپی
            </Button>
          </div>
        </div>
      ) : null}

      <div className="admin-schedule-weekly__desktop">
        {byWeekday.map((day) => (
          <section key={day.weekday} className="admin-schedule-weekly__column" aria-labelledby={`schedule-day-${day.weekday}`}>
            <div className="admin-schedule-weekly__column-head">
              <h3 id={`schedule-day-${day.weekday}`}>{day.label}</h3>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => clearDay(day.weekday)}>
                پاک‌سازی
              </Button>
            </div>
            <ScheduleWeekDayEditor
              day={day}
              disabled={disabled}
              supportsBreaks={supportsBreaks}
              issues={issues}
              onChange={updateDay}
            />
          </section>
        ))}
      </div>

      <div className="admin-schedule-weekly__mobile">
        <Accordion items={accordionItems} type="single" />
      </div>
    </div>
  );
}
