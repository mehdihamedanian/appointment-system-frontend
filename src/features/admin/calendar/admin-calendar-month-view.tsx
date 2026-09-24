"use client";

import { densityClass } from "@/lib/admin/calendar-layout";
import {
  eachIsoDateInclusive,
  isoDayOfWeek,
  visibleRangeFor,
} from "@/lib/admin/calendar-range";
import { todayIsoInTimeZone } from "@/lib/date-time/format";
import type { AdminCalendarView } from "@/types/admin-calendar";

const DOW_LABELS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function AdminCalendarMonthView({
  view,
  anchorDate,
  weekStartsOn,
  onSelectDay,
}: {
  view: AdminCalendarView;
  anchorDate: string;
  weekStartsOn: number;
  onSelectDay: (iso: string) => void;
}) {
  const { from, to } = visibleRangeFor(anchorDate, "month", weekStartsOn);
  const monthDays = eachIsoDateInclusive(from, to);
  const startDow = isoDayOfWeek(from);
  const padStart = (startDow - weekStartsOn + 7) % 7;
  const cells: Array<string | null> = [
    ...Array.from({ length: padStart }, () => null),
    ...monthDays,
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const today = todayIsoInTimeZone(view.timezone);
  const summaryByDate = new Map(view.daySummaries.map((s) => [s.date, s]));
  const closedByDate = new Map(view.closedPeriods.map((p) => [p.date, p]));

  const countByDate = new Map<string, number>();
  for (const event of view.events) {
    if (event.type !== "appointment") continue;
    const date = event.startsAt.slice(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  const headerDays = Array.from({ length: 7 }, (_, i) => DOW_LABELS[(weekStartsOn + i) % 7]!);

  return (
    <div className="admin-calendar-month" data-dnd="disabled">
      <div className="admin-calendar-month__head" role="row">
        {headerDays.map((label) => (
          <div key={label} className="admin-calendar-month__dow" role="columnheader">
            {label}
          </div>
        ))}
      </div>
      <div className="admin-calendar-month__grid" role="grid" aria-label="تقویم ماهانه">
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="admin-calendar-month__cell is-empty" />;
          }
          const summary = summaryByDate.get(date);
          const closed = closedByDate.get(date) ?? (summary?.closed ? summary : undefined);
          const count = summary?.appointmentCount ?? countByDate.get(date) ?? 0;
          const density = summary?.density ?? densityClass(count);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              className="admin-calendar-month__cell"
              data-today={isToday ? "true" : undefined}
              data-closed={closed ? "true" : undefined}
              data-density={density}
              aria-label={`${date}${closed ? "، تعطیل" : ""}، ${count} نوبت`}
              onClick={() => onSelectDay(date)}
            >
              <span className="admin-calendar-month__day ltr-value">{Number(date.slice(8))}</span>
              {closed ? (
                <span className="admin-calendar-month__closed">تعطیل</span>
              ) : count > 0 ? (
                <span className="admin-calendar-month__count">{count}</span>
              ) : (
                <span className="admin-calendar-month__count is-zero">۰</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
