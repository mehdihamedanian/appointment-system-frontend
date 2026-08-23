"use client";

import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { appointmentProviderLabel } from "@/lib/customer/appointment-detail-adapter";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import type { CancellationAppointmentSnapshot } from "@/types/appointment-cancellation";

export function CancellationAppointmentSummary({
  appointment,
}: {
  appointment: CancellationAppointmentSnapshot;
}) {
  const when = formatAppointmentParts(appointment.startsAt, appointment.timezone);
  const endParts = appointment.endsAt
    ? formatAppointmentParts(appointment.endsAt, appointment.timezone)
    : null;
  const provider = appointmentProviderLabel(appointment.provider);

  return (
    <section className="appointment-cancel-card" aria-labelledby="cancellation-target">
      <h2 id="cancellation-target" className="text-card-title">
        نوبتی که لغو می‌شود
      </h2>
      <dl className="booking-summary-list">
        <div>
          <dt>خدمت</dt>
          <dd>{appointment.serviceName}</dd>
        </div>
        {provider ? (
          <div>
            <dt>متخصص</dt>
            <dd>{provider}</dd>
          </div>
        ) : null}
        {appointment.branchName ? (
          <div>
            <dt>محل مراجعه</dt>
            <dd>{appointment.branchName}</dd>
          </div>
        ) : null}
        <div>
          <dt>تاریخ</dt>
          <dd>{when?.date ?? <span className="ltr-value">{appointment.startsAt}</span>}</dd>
        </div>
        <div>
          <dt>ساعت</dt>
          <dd>
            <span className="ltr-value">{when?.time}</span>
            {endParts?.time ? (
              <>
                {" "}
                تا <span className="ltr-value">{endParts.time}</span>
              </>
            ) : null}
          </dd>
        </div>
        {appointment.durationMinutes ? (
          <div>
            <dt>مدت</dt>
            <dd>{formatDurationMinutes(appointment.durationMinutes)}</dd>
          </div>
        ) : null}
        <div>
          <dt>کد رزرو</dt>
          <dd>
            <ReferenceCopy value={appointment.publicReference} label="رونوشت کد رزرو" />
          </dd>
        </div>
        <div>
          <dt>وضعیت نوبت</dt>
          <dd>
            <StatusBadge status={appointment.status} />
          </dd>
        </div>
        {appointment.paymentStatus ? (
          <div>
            <dt>وضعیت پرداخت</dt>
            <dd>
              <StatusBadge status={appointment.paymentStatus} />
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
