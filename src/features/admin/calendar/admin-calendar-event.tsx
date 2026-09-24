"use client";

import { formatAppointmentParts } from "@/lib/date-time/format";
import { getStatusPresentation } from "@/lib/status/status-map";
import { ADMIN_CALENDAR_DRAG_DROP_ENABLED } from "@/types/admin-calendar";
import type { AdminCalendarEventView } from "@/types/admin-calendar";
import type { LaidOutEvent } from "@/lib/admin/calendar-layout";

export function AdminCalendarEventChip({
  laidOut,
  timezone,
  dayStartMinutes,
  pixelsPerMinute,
  onActivate,
}: {
  laidOut: LaidOutEvent;
  timezone?: string;
  dayStartMinutes: number;
  pixelsPerMinute: number;
  onActivate: (event: AdminCalendarEventView) => void;
}) {
  const { event, startMinutes, endMinutes, lane, laneCount } = laidOut;
  const top = (startMinutes - dayStartMinutes) * pixelsPerMinute;
  const height = Math.max(18, (endMinutes - startMinutes) * pixelsPerMinute);
  const widthPct = 100 / laneCount;
  const leftPct = lane * widthPct;
  const time = formatAppointmentParts(event.startsAt, timezone)?.time;
  const status = event.status ? getStatusPresentation(event.status) : undefined;

  return (
    <button
      type="button"
      className="admin-calendar-event"
      data-type={event.type}
      data-status={event.status}
      data-dnd={ADMIN_CALENDAR_DRAG_DROP_ENABLED ? "enabled" : "disabled"}
      draggable={false}
      style={{
        top,
        height,
        insetInlineStart: `${leftPct}%`,
        width: `calc(${widthPct}% - 2px)`,
      }}
      aria-label={event.accessibleName}
      onClick={() => onActivate(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(event);
        }
      }}
    >
      <span className="admin-calendar-event__time ltr-value">{time}</span>
      <span className="admin-calendar-event__title">{event.title}</span>
      {event.type === "appointment" && event.serviceName ? (
        <span className="admin-calendar-event__meta">{event.serviceName}</span>
      ) : null}
      {event.type === "blocked" ? (
        <span className="admin-calendar-event__meta">
          {event.blockReason ?? "زمان مسدود"}
        </span>
      ) : null}
      {event.type === "time_off" ? (
        <span className="admin-calendar-event__meta">
          {event.timeOffLabel ?? "مرخصی"}
        </span>
      ) : null}
      {status ? (
        <span className="admin-calendar-event__status" data-tone={status.tone}>
          {status.label}
        </span>
      ) : null}
    </button>
  );
}
