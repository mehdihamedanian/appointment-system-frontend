"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/selection";
import { TimePicker } from "@/components/ui/date-time";
import type { AdminScheduleValidationIssue } from "@/lib/admin/schedule-adapter";
import { summarizeWeekday } from "@/lib/admin/schedule-adapter";
import type {
  AdminScheduleBreakInterval,
  AdminScheduleTimeInterval,
  AdminScheduleWeekdayDraft,
} from "@/types/admin-schedule";

function newLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function issueForInterval(issues: AdminScheduleValidationIssue[], intervalId: string) {
  return issues.filter((issue) => issue.intervalId === intervalId);
}

function issueForBreak(issues: AdminScheduleValidationIssue[], breakId: string) {
  return issues.filter((issue) => issue.breakId === breakId);
}

export function ScheduleWeekDayEditor({
  day,
  disabled,
  supportsBreaks,
  issues,
  onChange,
}: {
  day: AdminScheduleWeekdayDraft;
  disabled?: boolean;
  supportsBreaks?: boolean;
  issues: AdminScheduleValidationIssue[];
  onChange: (next: AdminScheduleWeekdayDraft) => void;
}) {
  const baseId = useId();

  function updateInterval(id: string, patch: Partial<AdminScheduleTimeInterval>) {
    onChange({
      ...day,
      intervals: day.intervals.map((interval) =>
        interval.id === id ? { ...interval, ...patch } : interval,
      ),
    });
  }

  function updateBreak(id: string, patch: Partial<AdminScheduleBreakInterval>) {
    onChange({
      ...day,
      breaks: day.breaks.map((brk) => (brk.id === id ? { ...brk, ...patch } : brk)),
    });
  }

  function addInterval() {
    const interval: AdminScheduleTimeInterval = {
      id: newLocalId("int"),
      start: "09:00",
      end: "17:00",
    };
    onChange({ ...day, intervals: [...day.intervals, interval] });
  }

  function removeInterval(id: string) {
    onChange({ ...day, intervals: day.intervals.filter((interval) => interval.id !== id) });
  }

  function addBreak() {
    const brk: AdminScheduleBreakInterval = { id: newLocalId("brk"), start: "12:00", end: "13:00" };
    onChange({ ...day, breaks: [...day.breaks, brk] });
  }

  function removeBreak(id: string) {
    onChange({ ...day, breaks: day.breaks.filter((brk) => brk.id !== id) });
  }

  const dayIssues = issues.filter((issue) => issue.weekday === day.weekday && !issue.intervalId && !issue.breakId);

  return (
    <div className="admin-schedule-day" data-weekday={day.weekday}>
      <div className="admin-schedule-day__head">
        <Switch
          label={`${day.label}: باز`}
          checked={!day.closed}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({
              ...day,
              closed: !checked,
              intervals: checked && day.intervals.length === 0 ? [{ id: newLocalId("int"), start: "09:00", end: "17:00" }] : day.intervals,
              breaks: checked ? day.breaks : [],
            })
          }
        />
        <p className="admin-schedule-day__summary" aria-live="polite">
          {summarizeWeekday(day)}
        </p>
      </div>

      {day.closed ? (
        <p className="ds-help">این روز تعطیل است.</p>
      ) : (
        <>
          <div className="admin-schedule-intervals">
            {day.intervals.map((interval, index) => {
              const intervalIssues = issueForInterval(issues, interval.id);
              const startInvalid = intervalIssues.some((i) => i.field === "start");
              const endInvalid = intervalIssues.some((i) => i.field === "end" || !i.field);
              return (
                <div key={interval.id} className="admin-schedule-interval-row">
                  <TimePicker
                    id={`${baseId}-${interval.id}-start`}
                    value={interval.start}
                    disabled={disabled}
                    invalid={startInvalid}
                    onChange={(value) => updateInterval(interval.id, { start: value })}
                  />
                  <span aria-hidden="true">تا</span>
                  <TimePicker
                    id={`${baseId}-${interval.id}-end`}
                    value={interval.end}
                    disabled={disabled}
                    invalid={endInvalid}
                    onChange={(value) => updateInterval(interval.id, { end: value })}
                  />
                  <IconButton
                    size="sm"
                    label={`حذف بازه ${index + 1}`}
                    disabled={disabled || day.intervals.length <= 1}
                    onClick={() => removeInterval(interval.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                  {intervalIssues.length > 0 ? (
                    <p className="admin-schedule-field-error" role="alert">
                      {intervalIssues.map((issue) => issue.message).join(" ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={addInterval}
          >
            <Plus size={14} aria-hidden="true" />
            افزودن بازه
          </Button>

          {supportsBreaks !== false ? (
            <div className="admin-schedule-breaks">
              <h4 className="text-card-title">استراحت</h4>
              {day.breaks.length === 0 ? (
                <p className="ds-help">استراحتی ثبت نشده.</p>
              ) : null}
              {day.breaks.map((brk, index) => {
                const breakIssues = issueForBreak(issues, brk.id);
                return (
                  <div key={brk.id} className="admin-schedule-interval-row">
                    <TimePicker
                      id={`${baseId}-${brk.id}-start`}
                      value={brk.start}
                      disabled={disabled}
                      invalid={breakIssues.length > 0}
                      onChange={(value) => updateBreak(brk.id, { start: value })}
                    />
                    <span aria-hidden="true">تا</span>
                    <TimePicker
                      id={`${baseId}-${brk.id}-end`}
                      value={brk.end}
                      disabled={disabled}
                      invalid={breakIssues.length > 0}
                      onChange={(value) => updateBreak(brk.id, { end: value })}
                    />
                    <IconButton
                      size="sm"
                      label={`حذف استراحت ${index + 1}`}
                      disabled={disabled}
                      onClick={() => removeBreak(brk.id)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                    {breakIssues.length > 0 ? (
                      <p className="admin-schedule-field-error" role="alert">
                        {breakIssues.map((issue) => issue.message).join(" ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={addBreak}>
                <Plus size={14} aria-hidden="true" />
                افزودن استراحت
              </Button>
            </div>
          ) : null}
        </>
      )}

      {dayIssues.length > 0 ? (
        <p className="admin-schedule-field-error" role="alert">
          {dayIssues.map((issue) => issue.message).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
