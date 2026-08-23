"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  getCalendarAdapter,
  parseIsoDate,
  parseIsoMonth,
  toIsoDate,
  toIsoMonth,
} from "@/lib/date-time/calendar-adapter";
import { calendarDayStateLabel } from "@/lib/availability/days";
import { cx } from "@/lib/utilities/cx";
import type { CalendarDayVisualState } from "@/types/availability";

export type CalendarMonth = {
  year: number;
  monthIndex: number;
};

export function Calendar({
  value,
  onChange,
  min,
  max,
  today: todayProp,
  month,
  onMonthChange,
  isDateDisabled,
  dayState,
  loading,
}: {
  value?: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  today?: string;
  month?: string;
  onMonthChange?: (month: string) => void;
  isDateDisabled?: (isoDate: string) => boolean;
  dayState?: (isoDate: string, inCurrentMonth: boolean) => CalendarDayVisualState;
  loading?: boolean;
}) {
  const adapter = getCalendarAdapter();
  const today = todayProp ?? toIsoDate(new Date());
  const selected = value;
  const initialIso = selected ?? today;
  const initialParts = initialIso.split("-").map(Number);
  const controlled = month ? parseIsoMonth(month) : null;
  const [uncontrolled, setUncontrolled] = useState<CalendarMonth>(
    () => controlled ?? { year: initialParts[0], monthIndex: initialParts[1] - 1 },
  );
  const cursor = controlled ?? uncontrolled;
  const gridRef = useRef<HTMLDivElement>(null);

  const matrix = useMemo(
    () => adapter.getMatrix(cursor.year, cursor.monthIndex),
    [adapter, cursor.monthIndex, cursor.year],
  );

  function emitMonth(next: CalendarMonth) {
    if (!controlled) {
      setUncontrolled(next);
    }
    onMonthChange?.(toIsoMonth(next.year, next.monthIndex));
    gridRef.current?.focus();
  }

  function moveMonth(delta: number) {
    emitMonth(adapter.addMonths(cursor.year, cursor.monthIndex, delta));
  }

  function isDisabled(iso: string, inCurrentMonth: boolean) {
    if (loading) return true;
    if (!inCurrentMonth) return true;
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return Boolean(isDateDisabled?.(iso));
  }

  function canNavigate(delta: number) {
    const next = adapter.addMonths(cursor.year, cursor.monthIndex, delta);
    const nextMonth = toIsoMonth(next.year, next.monthIndex);
    if (delta < 0 && min && nextMonth < min.slice(0, 7)) {
      return false;
    }
    if (delta > 0 && max && nextMonth > max.slice(0, 7)) {
      return false;
    }
    return true;
  }

  function moveDay(current: string, days: number) {
    const date = parseIsoDate(current) ?? parseIsoDate(today) ?? new Date();
    date.setDate(date.getDate() + days);
    const iso = toIsoDate(date);
    const inMonth = date.getMonth() === cursor.monthIndex && date.getFullYear() === cursor.year;
    if (!isDisabled(iso, true)) {
      onChange(iso);
      emitMonth({ year: date.getFullYear(), monthIndex: date.getMonth() });
      return;
    }
    if (!inMonth) {
      emitMonth({ year: date.getFullYear(), monthIndex: date.getMonth() });
    }
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const start = selected ?? today;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveDay(start, rtl ? -1 : 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveDay(start, rtl ? 1 : -1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveDay(start, -7);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveDay(start, 7);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (!isDisabled(today, true)) {
        onChange(today);
      }
    } else if (event.key === "PageUp") {
      event.preventDefault();
      if (canNavigate(-1)) {
        moveMonth(-1);
      }
    } else if (event.key === "PageDown") {
      event.preventDefault();
      if (canNavigate(1)) {
        moveMonth(1);
      }
    }
  }

  return (
    <div className={cx("ds-calendar", loading && "is-loading")} data-loading={loading ? "true" : undefined}>
      <div className="ds-calendar__nav">
        <IconButton label="ماه قبل" onClick={() => moveMonth(-1)} disabled={!canNavigate(-1)}>
          <ChevronRight className="icon-dir" size={18} />
        </IconButton>
        <p className="text-card-title" aria-live="polite">
          {adapter.monthLabel(cursor.year, cursor.monthIndex)}
        </p>
        <IconButton label="ماه بعد" onClick={() => moveMonth(1)} disabled={!canNavigate(1)}>
          <ChevronLeft className="icon-dir" size={18} />
        </IconButton>
      </div>
      <div
        ref={gridRef}
        className="ds-calendar__grid"
        role="grid"
        aria-label="تقویم"
        aria-busy={loading || undefined}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
      >
        {adapter.weekDayLabels.map((label) => (
          <div key={label} className="ds-calendar__dow" aria-hidden="true">
            {label}
          </div>
        ))}
        {matrix.flat().map((day) => {
          const disabled = isDisabled(day.isoDate, day.inCurrentMonth);
          const state =
            dayState?.(day.isoDate, day.inCurrentMonth) ??
            (disabled ? "disabled" : "default");
          const isToday = day.isoDate === today;
          const isSelected = day.isoDate === selected;
          const stateText = calendarDayStateLabel(isSelected ? "selected" : state);
          const todayText = isToday ? calendarDayStateLabel("today") : "";
          return (
            <button
              key={day.isoDate + String(day.inCurrentMonth)}
              type="button"
              role="gridcell"
              className="ds-calendar__day"
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-disabled={disabled || undefined}
              aria-label={`${day.date.getDate()}${todayText ? `، ${todayText}` : ""}${stateText ? `، ${stateText}` : ""}`}
              data-selected={isSelected ? "true" : undefined}
              data-today={isToday ? "true" : undefined}
              data-outside={day.inCurrentMonth ? undefined : "true"}
              data-availability={state}
              disabled={disabled}
              onClick={() => onChange(day.isoDate)}
            >
              <span className="ltr-value">{day.date.getDate()}</span>
              {state === "available" || isSelected ? (
                <span className="ds-calendar__mark" aria-hidden="true">
                  {isSelected ? "✓" : "•"}
                </span>
              ) : null}
              {state === "closed" ? (
                <span className="ds-calendar__mark" aria-hidden="true">
                  —
                </span>
              ) : null}
              {state === "no_capacity" ? (
                <span className="ds-calendar__mark" aria-hidden="true">
                  ×
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
