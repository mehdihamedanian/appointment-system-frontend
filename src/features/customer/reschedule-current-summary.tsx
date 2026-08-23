"use client";

import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import {
  appointmentProviderLabel,
  formatRescheduleWhen,
} from "@/lib/customer/appointment-reschedule-adapter";
import { formatDurationMinutes } from "@/lib/date-time/format";
import type { RescheduleAppointmentSnapshot } from "@/types/appointment-reschedule";

export function RescheduleCurrentSummary({
  appointment,
  heading = "نوبت فعلی",
}: {
  appointment: RescheduleAppointmentSnapshot;
  heading?: string;
}) {
  const when = formatRescheduleWhen(
    appointment.startsAt,
    appointment.endsAt,
    appointment.timezone,
  );
  const provider = appointmentProviderLabel(appointment.provider);

  return (
    <section className="appointment-reschedule-card" aria-labelledby="reschedule-current">
      <h2 id="reschedule-current" className="text-card-title">
        {heading}
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
          <dd>{when.date ?? <span className="ltr-value">{appointment.startsAt}</span>}</dd>
        </div>
        <div>
          <dt>ساعت</dt>
          <dd>
            <span className="ltr-value">{when.range ?? when.time}</span>
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
