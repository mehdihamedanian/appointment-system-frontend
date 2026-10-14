"use client";

import { formatAppointmentParts, formatIsoDateLabel } from "@/lib/date-time/format";
import { getStatusPresentation } from "@/lib/status/status-map";
import { StatusBadge } from "@/components/ui/data-display";
import { isoDateInTimeZone } from "@/lib/admin/calendar-range";
import type { AdminCalendarEventView, AdminCalendarView } from "@/types/admin-calendar";

export function AdminCalendarAgenda({
  view,
  onActivate,
}: {
  view: AdminCalendarView;
  onActivate: (event: AdminCalendarEventView) => void;
}) {
  const sorted = [...view.events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <div className="admin-calendar-agenda" role="status">
        <p className="ds-help">در این بازه رویدادی ثبت نشده است.</p>
      </div>
    );
  }

  const groups: Array<{ date: string; events: AdminCalendarEventView[] }> = [];
  for (const event of sorted) {
    const date = isoDateInTimeZone(event.startsAt, view.timezone) ?? event.startsAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.events.push(event);
    } else {
      groups.push({ date, events: [event] });
    }
  }

  return (
    <div className="admin-calendar-agenda" role="list" aria-label="فهرست رویدادهای تقویم">
      {groups.map((group) => (
        <div key={group.date} role="listitem">
          <h3 className="admin-calendar-agenda__date">
            <time dateTime={group.date}>
              {formatIsoDateLabel(group.date, { weekday: true }) ?? group.date}
            </time>
          </h3>
          {group.events.map((event) => {
            const parts = formatAppointmentParts(event.startsAt, view.timezone);
            const endParts = formatAppointmentParts(event.endsAt, view.timezone);
            return (
              <button
                key={event.id}
                type="button"
                className="admin-calendar-agenda__item"
                data-type={event.type}
                aria-label={event.accessibleName}
                onClick={() => onActivate(event)}
              >
                <span className="admin-calendar-agenda__time ltr-value">
                  {parts?.time}
                  {endParts?.time ? `–${endParts.time}` : ""}
                </span>
                <span className="admin-calendar-agenda__body">
                  <strong>{event.title}</strong>
                  {event.type === "appointment" && event.serviceName ? (
                    <span>{event.serviceName}</span>
                  ) : null}
                  {event.type === "blocked" ? (
                    <span>{event.blockReason ?? "زمان مسدود"}</span>
                  ) : null}
                  {event.type === "time_off" ? (
                    <span>{event.timeOffLabel ?? "مرخصی"}</span>
                  ) : null}
                  {event.staffName ? <span>{event.staffName}</span> : null}
                  {event.branchName ? <span>{event.branchName}</span> : null}
                </span>
                {event.status ? (
                  <StatusBadge
                    status={event.status}
                    label={getStatusPresentation(event.status).label}
                  />
                ) : (
                  <span className="text-caption">
                    {event.type === "blocked" ? "مسدود" : event.type === "time_off" ? "مرخصی" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
