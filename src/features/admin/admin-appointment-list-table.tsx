"use client";

import Link from "next/link";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { appointmentProviderLabel } from "@/lib/admin/appointment-adapter";
import { routes } from "@/constants/routes";
import { StatusBadge } from "@/components/ui/data-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAppointmentListItem } from "@/types/admin-appointment";

export function AdminAppointmentListTable({
  items,
  showBranch,
  showResource,
}: {
  items: AdminAppointmentListItem[];
  showBranch?: boolean;
  showResource?: boolean;
}) {
  return (
    <div className="admin-appointment-table-wrap">
      <Table caption="فهرست نوبت‌های مدیریت">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">کد رزرو</TableHead>
            <TableHead scope="col">زمان</TableHead>
            <TableHead scope="col">مشتری</TableHead>
            <TableHead scope="col">خدمت</TableHead>
            <TableHead scope="col">پرسنل</TableHead>
            {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
            {showResource ? <TableHead scope="col">منبع</TableHead> : null}
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">پرداخت</TableHead>
            <TableHead scope="col">منبع رزرو</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const time = formatAppointmentParts(item.startsAt, item.timezone);
            const provider = appointmentProviderLabel(item.provider);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="ltr-value">{item.reference}</span>
                </TableCell>
                <TableCell>
                  <time className="text-numeric ltr-value" dateTime={item.startsAt}>
                    {time?.label ?? item.startsAt}
                  </time>
                </TableCell>
                <TableCell>{item.customerName}</TableCell>
                <TableCell>{item.service.name}</TableCell>
                <TableCell>{provider ?? "—"}</TableCell>
                {showBranch ? <TableCell>{item.branch?.name ?? "—"}</TableCell> : null}
                {showResource ? <TableCell>{item.resourceName ?? "—"}</TableCell> : null}
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  {item.paymentStatus ? <StatusBadge status={item.paymentStatus} /> : "—"}
                </TableCell>
                <TableCell>{item.bookingSource ?? "—"}</TableCell>
                <TableCell>
                  <Link href={routes.admin.appointmentDetail(item.id)}>جزئیات</Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminAppointmentListCards({ items }: { items: AdminAppointmentListItem[] }) {
  return (
    <ul className="admin-appointment-cards" aria-label="نوبت‌ها">
      {items.map((item) => {
        const time = formatAppointmentParts(item.startsAt, item.timezone);
        const provider = appointmentProviderLabel(item.provider);
        return (
          <li key={item.id}>
            <article className="admin-appointment-card ds-card">
              <div className="admin-appointment-card__head">
                <span className="ltr-value">{item.reference}</span>
                <StatusBadge status={item.status} />
              </div>
              <time className="text-numeric ltr-value" dateTime={item.startsAt}>
                {time?.label ?? item.startsAt}
              </time>
              <p>{item.customerName}</p>
              <p className="text-caption">{item.service.name}</p>
              {provider ? <p className="text-caption">{provider}</p> : null}
              {item.paymentStatus ? (
                <StatusBadge status={item.paymentStatus} />
              ) : null}
              <Link href={routes.admin.appointmentDetail(item.id)} className="admin-appointment-card__link">
                جزئیات
              </Link>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
