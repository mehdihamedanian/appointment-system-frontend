"use client";

import { useMemo } from "react";
import { layoutOverlappingEvents } from "@/lib/admin/calendar-layout";
import {
  formatHm,
  isoDateInTimeZone,
  isoDayOfWeek,
  minutesFromMidnight,
  parseHmToMinutes,
} from "@/lib/admin/calendar-range";
import { AdminCalendarEventChip } from "@/features/admin/calendar/admin-calendar-event";
import type {
  AdminCalendarColumn,
  AdminCalendarEventView,
  AdminCalendarView,
  AdminCalendarWorkingHours,
} from "@/types/admin-calendar";

const PIXELS_PER_MINUTE = 1.2;

function workingWindow(
  hours: AdminCalendarWorkingHours[],
  dayOfWeek: number,
): { start: number; end: number } {
  const forDay = hours.filter((h) => h.dayOfWeek === dayOfWeek);
  if (forDay.length === 0) {
    return { start: 8 * 60, end: 20 * 60 };
  }
  let start = 24 * 60;
  let end = 0;
  for (const h of forDay) {
    const s = parseHmToMinutes(h.start);
    const e = parseHmToMinutes(h.end);
    if (s !== null) start = Math.min(start, s);
    if (e !== null) end = Math.max(end, e);
  }
  if (start >= end) return { start: 8 * 60, end: 20 * 60 };
  return { start, end };
}

function isClosed(view: AdminCalendarView, date: string): AdminCalendarView["closedPeriods"][0] | undefined {
  return view.closedPeriods.find((p) => p.date === date);
}

export function AdminCalendarTimeGrid({
  view,
  dates,
  columns,
  onActivate,
  showNowLine,
}: {
  view: AdminCalendarView;
  dates: string[];
  columns: AdminCalendarColumn[];
  onActivate: (event: AdminCalendarEventView) => void;
  showNowLine?: boolean;
}) {
  const primaryDate = dates[0] ?? view.from;
  const dow = isoDayOfWeek(primaryDate);
  const window = workingWindow(view.workingHours, dow);
  const dayStart = Math.max(0, window.start - 60);
  const dayEnd = Math.min(24 * 60, window.end + 60);
  const interval = Math.max(15, view.slotIntervalMinutes);
  const hours: number[] = [];
  for (let m = dayStart; m < dayEnd; m += interval) {
    if (m % 60 === 0 || interval >= 60) hours.push(m);
    else if (m === dayStart) hours.push(m);
  }
  // Ensure hour labels every hour
  const hourMarks: number[] = [];
  for (let m = Math.floor(dayStart / 60) * 60; m <= dayEnd; m += 60) {
    if (m >= dayStart) hourMarks.push(m);
  }

  const totalHeight = (dayEnd - dayStart) * PIXELS_PER_MINUTE;
  const nowMinutes = view.serverNow
    ? minutesFromMidnight(view.serverNow, view.timezone)
    : minutesFromMidnight(new Date().toISOString(), view.timezone);
  const todayIso = view.serverNow
    ? isoDateInTimeZone(view.serverNow, view.timezone)
    : isoDateInTimeZone(new Date().toISOString(), view.timezone);

  const eventsByColumnDate = useMemo(() => {
    const map = new Map<string, AdminCalendarEventView[]>();
    for (const event of view.events) {
      const date = isoDateInTimeZone(event.startsAt, view.timezone);
      if (!date || !dates.includes(date)) continue;
      const key = `${event.columnId}|${date}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [view.events, view.timezone, dates]);

  const displayColumns = columns.length > 0 ? columns : [{ id: "general", label: "عمومی", kind: "general" as const }];

  return (
    <div
      className="admin-calendar-time-grid"
      data-dnd="disabled"
      style={{ ["--admin-cal-height" as string]: `${totalHeight}px` }}
    >
      <div className="admin-calendar-time-grid__header">
        <div className="admin-calendar-time-grid__gutter" aria-hidden="true" />
        {dates.map((date) =>
          displayColumns.map((col) => (
            <div key={`${date}-${col.id}`} className="admin-calendar-time-grid__col-head">
              {dates.length > 1 ? (
                <span className="ltr-value text-caption">{date}</span>
              ) : null}
              <strong>{col.label}</strong>
            </div>
          )),
        )}
      </div>
      <div className="admin-calendar-time-grid__body">
        <div className="admin-calendar-time-grid__gutter" style={{ height: totalHeight }}>
          {hourMarks.map((m) => (
            <div
              key={m}
              className="admin-calendar-time-grid__hour"
              style={{ top: (m - dayStart) * PIXELS_PER_MINUTE }}
            >
              <span className="ltr-value">{formatHm(m)}</span>
            </div>
          ))}
        </div>
        {dates.map((date) => {
          const closed = isClosed(view, date);
          const dayHours = workingWindow(view.workingHours, isoDayOfWeek(date));
          return displayColumns.map((col) => {
            const key = `${col.id}|${date}`;
            const laidOut = layoutOverlappingEvents(
              eventsByColumnDate.get(key) ?? [],
              view.timezone,
              dayStart,
              dayEnd,
            );
            const isToday = date === todayIso;
            return (
              <div
                key={key}
                className="admin-calendar-time-grid__column"
                data-closed={closed ? "true" : undefined}
                data-today={isToday ? "true" : undefined}
                style={{ height: totalHeight }}
              >
                {/* Outside working hours */}
                <div
                  className="admin-calendar-time-grid__outside"
                  style={{
                    top: 0,
                    height: Math.max(0, (dayHours.start - dayStart) * PIXELS_PER_MINUTE),
                  }}
                  aria-hidden="true"
                />
                <div
                  className="admin-calendar-time-grid__outside"
                  style={{
                    top: (dayHours.end - dayStart) * PIXELS_PER_MINUTE,
                    height: Math.max(0, (dayEnd - dayHours.end) * PIXELS_PER_MINUTE),
                  }}
                  aria-hidden="true"
                />
                {closed ? (
                  <div className="admin-calendar-time-grid__closed" role="status">
                    تعطیل{closed.reason ? ` — ${closed.reason}` : ""}
                  </div>
                ) : null}
                {hourMarks.map((m) => (
                  <div
                    key={`line-${m}`}
                    className="admin-calendar-time-grid__line"
                    style={{ top: (m - dayStart) * PIXELS_PER_MINUTE }}
                    aria-hidden="true"
                  />
                ))}
                {showNowLine &&
                isToday &&
                nowMinutes !== null &&
                nowMinutes >= dayStart &&
                nowMinutes <= dayEnd ? (
                  <div
                    className="admin-calendar-time-grid__now"
                    style={{ top: (nowMinutes - dayStart) * PIXELS_PER_MINUTE }}
                    aria-hidden="true"
                  />
                ) : null}
                {laidOut.map((item) => (
                  <AdminCalendarEventChip
                    key={item.event.id}
                    laidOut={item}
                    timezone={view.timezone}
                    dayStartMinutes={dayStart}
                    pixelsPerMinute={PIXELS_PER_MINUTE}
                    onActivate={onActivate}
                  />
                ))}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
