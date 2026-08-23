import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatusBadge } from "@/components/ui/data-display";
import { routes } from "@/constants/routes";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import type { AppointmentPreview } from "@/types/customer";

export function NextAppointmentCard({
  appointment,
}: {
  appointment: AppointmentPreview;
}) {
  const when = formatAppointmentParts(appointment.startsAt, appointment.timezone);

  return (
    <article className="ds-card dashboard-next" aria-labelledby="next-appointment-title">
      <div className="dashboard-next__status">
        <StatusBadge status={appointment.status} />
        {appointment.paymentStatus ? (
          <StatusBadge status={appointment.paymentStatus} />
        ) : null}
      </div>
      <h2 id="next-appointment-title" className="text-card-title">
        نزدیک‌ترین نوبت
      </h2>
      <p className="dashboard-next__service">{appointment.serviceName}</p>
      {appointment.providerName ? <p>{appointment.providerName}</p> : null}
      {appointment.branchName ? <p>{appointment.branchName}</p> : null}
      {when ? (
        <p>
          <time dateTime={appointment.startsAt}>{when.label}</time>
        </p>
      ) : null}
      {appointment.durationMinutes ? (
        <p>{formatDurationMinutes(appointment.durationMinutes)}</p>
      ) : null}
      {appointment.reference ? (
        <p className="text-caption">
          کد رزرو: <span className="ltr-value">{appointment.reference}</span>
        </p>
      ) : null}
      <Button asChild>
        <Link href={routes.customer.appointmentDetail(appointment.id)}>مشاهده جزئیات</Link>
      </Button>
    </article>
  );
}

export function UpcomingAppointmentRow({
  appointment,
}: {
  appointment: AppointmentPreview;
}) {
  const when = formatAppointmentParts(appointment.startsAt, appointment.timezone);
  return (
    <li className="dashboard-upcoming-item">
      <Card>
        <div className="dashboard-next__status">
          <StatusBadge status={appointment.status} />
          {appointment.paymentStatus ? <StatusBadge status={appointment.paymentStatus} /> : null}
        </div>
        <h3>{appointment.serviceName}</h3>
        {appointment.providerName ? <p>{appointment.providerName}</p> : null}
        {when ? (
          <p>
            <time dateTime={appointment.startsAt}>{when.label}</time>
          </p>
        ) : null}
        {appointment.branchName ? <p>{appointment.branchName}</p> : null}
        <Button asChild variant="outline" size="sm">
          <Link href={routes.customer.appointmentDetail(appointment.id)}>جزئیات نوبت</Link>
        </Button>
      </Card>
    </li>
  );
}
