"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  getCalendarAdapter,
  type CalendarMonth,
  type CalendarSystem,
} from "@/lib/date-time/calendar-adapter";
import { todayIsoInTimeZone } from "@/lib/date-time/format";
import { addDaysToIsoDate, isIsoDate } from "@/lib/date-time/zoned";
import { calendarDayStateLabel } from "@/lib/availability/days";
import { cx } from "@/lib/utilities/cx";
import type { CalendarDayVisualState } from "@/types/availability";

export type { CalendarMonth };

/** Full names for the Saturday-first column headers. */
const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/**
 * `value`, `min`, `max`, `today`, and `onChange` use Gregorian ISO dates.
 * `month`/`onMonthChange` use month keys of the active calendar system
 * (see `calendarMonthBounds`). Without `today`, the business-timezone date is used.
 */
export function Calendar({
  value,
  onChange,
  min,
  max,
  today: todayProp,
  timeZone,
  month,
  onMonthChange,
  isDateDisabled,
  dayState,
  loading,
  calendar,
}: {
  value?: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  today?: string;
  timeZone?: string;
  month?: string;
  onMonthChange?: (month: string) => void;
  isDateDisabled?: (isoDate: string) => boolean;
  dayState?: (isoDate: string, inCurrentMonth: boolean) => CalendarDayVisualState;
  loading?: boolean;
  calendar?: CalendarSystem;
}) {
  const adapter = getCalendarAdapter(calendar);
  const today = todayProp && isIsoDate(todayProp) ? todayProp : todayIsoInTimeZone(timeZone);
  const selected = value && isIsoDate(value) ? value : undefined;
  const controlled = month ? adapter.parseMonthKey(month) : null;
  const [uncontrolled, setUncontrolled] = useState<CalendarMonth>(
    () => controlled ?? adapter.monthOf(selected ?? today) ?? { year: 0, monthIndex: 0 },
  );
  const cursor = controlled ?? uncontrolled;
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const pendingFocus = useRef(false);

  const { year: cursorYear, monthIndex: cursorMonthIndex } = cursor;
  const matrix = useMemo(
    () => adapter.getMatrix({ year: cursorYear, monthIndex: cursorMonthIndex }),
    [adapter, cursorYear, cursorMonthIndex],
  );

  function emitMonth(next: CalendarMonth) {
    if (!controlled) {
      setUncontrolled(next);
    }
    onMonthChange?.(adapter.monthKey(next));
  }

  function moveMonth(delta: number) {
    emitMonth(adapter.addMonths(cursor, delta));
  }

  function isCursorMonth(month: CalendarMonth) {
    return month.year === cursor.year && month.monthIndex === cursor.monthIndex;
  }

  function isDisabled(iso: string, inCurrentMonth: boolean) {
    if (loading) return true;
    if (!inCurrentMonth) return true;
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return Boolean(isDateDisabled?.(iso));
  }

  function canNavigate(delta: number) {
    const range = adapter.monthRange(adapter.addMonths(cursor, delta));
    if (delta < 0 && min && range.to < min) {
      return false;
    }
    if (delta > 0 && max && range.from > max) {
      return false;
    }
    return true;
  }

  const days = matrix.flat();
  const enabledDates = days
    .filter((day) => !isDisabled(day.isoDate, day.inCurrentMonth))
    .map((day) => day.isoDate);
  // Roving tabindex: exactly one enabled day is in the tab order.
  const rovingDate =
    [focusedDate, selected, today].find((iso) => iso && enabledDates.includes(iso)) ??
    enabledDates[0] ??
    null;

  useEffect(() => {
    if (!pendingFocus.current || !rovingDate) return;
    pendingFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${rovingDate}"]`)?.focus();
  });

  function focusDate(iso: string) {
    pendingFocus.current = true;
    setFocusedDate(iso);
    const month = adapter.monthOf(iso);
    if (month && !isCursorMonth(month)) {
      emitMonth(month);
    }
  }

  /** Moves focus by `step` days, skipping unavailable days of the visible month. */
  function moveFocus(from: string, step: number) {
    if (loading) return;
    let iso = from;
    for (let guard = 0; guard < 42; guard += 1) {
      iso = addDaysToIsoDate(iso, step);
      if ((min && iso < min) || (max && iso > max)) return;
      const month = adapter.monthOf(iso);
      if (!month) return;
      if (!isCursorMonth(month) || !isDisabled(iso, true)) {
        focusDate(iso);
        return;
      }
    }
  }

  function moveFocusByMonth(from: string, delta: number) {
    if (!canNavigate(delta)) return;
    const range = adapter.monthRange(adapter.addMonths(cursor, delta));
    const day = adapter.dayOfMonth(from) ?? 1;
    const target = addDaysToIsoDate(range.from, day - 1);
    focusDate(target > range.to ? range.to : target);
  }

  function moveFocusInWeek(from: string, toEnd: boolean) {
    const week = matrix.find((row) => row.some((day) => day.isoDate === from));
    const candidates = (toEnd ? [...(week ?? [])].reverse() : (week ?? [])).filter(
      (day) => !isDisabled(day.isoDate, day.inCurrentMonth),
    );
    if (candidates[0]) focusDate(candidates[0].isoDate);
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const from = target.dataset.date ?? rovingDate;
    if (!from) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const handlers: Record<string, () => void> = {
      ArrowRight: () => moveFocus(from, rtl ? -1 : 1),
      ArrowLeft: () => moveFocus(from, rtl ? 1 : -1),
      ArrowUp: () => moveFocus(from, -7),
      ArrowDown: () => moveFocus(from, 7),
      Home: () => moveFocusInWeek(from, false),
      End: () => moveFocusInWeek(from, true),
      PageUp: () => moveFocusByMonth(from, -1),
      PageDown: () => moveFocusByMonth(from, 1),
    };
    const handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  const monthName = adapter.monthName(cursor);

  return (
    <div
      className={cx("ds-calendar", loading && "is-loading")}
      data-loading={loading ? "true" : undefined}
      data-calendar={adapter.id}
    >
      <div className="ds-calendar__nav">
        <IconButton label="ماه قبل" onClick={() => moveMonth(-1)} disabled={!canNavigate(-1)}>
          <ChevronRight className="icon-dir" size={18} />
        </IconButton>
        <p id={labelId} className="text-card-title" aria-live="polite">
          {adapter.monthLabel(cursor)}
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
        aria-describedby={labelId}
        aria-busy={loading || undefined}
        onKeyDown={onGridKeyDown}
      >
        <div className="ds-calendar__row" role="row">
          {adapter.weekDayLabels.map((label, index) => (
            <div key={label} className="ds-calendar__dow" role="columnheader">
              <span aria-hidden="true">{label}</span>
              <span className="visually-hidden">{WEEKDAY_NAMES[index]}</span>
            </div>
          ))}
        </div>
        {matrix.map((week) => (
          <div key={week[0]?.isoDate} className="ds-calendar__row" role="row">
            {week.map((day) => {
              const disabled = isDisabled(day.isoDate, day.inCurrentMonth);
              const state =
                dayState?.(day.isoDate, day.inCurrentMonth) ??
                (disabled ? "disabled" : "default");
              const isToday = day.isoDate === today;
              const isSelected = day.isoDate === selected;
              const stateText = calendarDayStateLabel(isSelected ? "selected" : state);
              const todayText = isToday ? calendarDayStateLabel("today") : "";
              const dayName = day.inCurrentMonth ? `${day.dayOfMonth} ${monthName}` : String(day.dayOfMonth);
              return (
                <button
                  key={day.isoDate + String(day.inCurrentMonth)}
                  type="button"
                  role="gridcell"
                  className="ds-calendar__day"
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-disabled={disabled || undefined}
                  aria-label={`${dayName}${todayText ? `، ${todayText}` : ""}${stateText ? `، ${stateText}` : ""}`}
                  data-date={day.isoDate}
                  data-selected={isSelected ? "true" : undefined}
                  data-today={isToday ? "true" : undefined}
                  data-outside={day.inCurrentMonth ? undefined : "true"}
                  data-availability={state}
                  disabled={disabled}
                  tabIndex={day.isoDate === rovingDate ? 0 : -1}
                  onFocus={() => setFocusedDate(day.isoDate)}
                  onClick={() => onChange(day.isoDate)}
                >
                  <span className="ltr-value">{day.dayOfMonth}</span>
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
        ))}
      </div>
    </div>
  );
}
