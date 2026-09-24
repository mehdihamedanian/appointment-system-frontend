"use client";

import Link from "next/link";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { getStatusPresentation } from "@/lib/status/status-map";
import { routes } from "@/constants/routes";
import { EmptyState } from "@/components/feedback/app-states";
import { StatusBadge } from "@/components/ui/data-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminRecentAppointment } from "@/types/admin-dashboard";

function AppointmentStatusCell({
  status,
  paymentStatus,
}: {
  status: AdminRecentAppointment["status"];
  paymentStatus?: AdminRecentAppointment["paymentStatus"];
}) {
  return (
    <div className="admin-recent__statuses">
      <StatusBadge status={status} />
      {paymentStatus ? (
        <StatusBadge status={paymentStatus} label={getStatusPresentation(paymentStatus).label} />
      ) : null}
    </div>
  );
}

function RecentAppointmentCard({ item }: { item: AdminRecentAppointment }) {
  const time = formatAppointmentParts(item.startsAt, item.timezone);
  const detailHref = routes.admin.appointmentDetail(item.id);

  return (
    <article className="admin-recent-card ds-card">
      <div className="admin-recent-card__head">
        <time className="text-numeric ltr-value" dateTime={item.startsAt}>
          {time?.label ?? item.startsAt}
        </time>
        <AppointmentStatusCell status={item.status} paymentStatus={item.paymentStatus} />
      </div>
      <p className="admin-recent-card__customer">{item.customerName}</p>
      <p className="text-caption">{item.serviceName}</p>
      {item.providerName ? <p className="text-caption">ارائه‌دهنده: {item.providerName}</p> : null}
      {item.resourceName ? <p className="text-caption">منبع: {item.resourceName}</p> : null}
      {item.branchName ? <p className="text-caption">شعبه: {item.branchName}</p> : null}
      <Link href={detailHref} className="admin-recent-card__link">
        جزئیات نوبت
      </Link>
    </article>
  );
}

export function AdminRecentAppointments({
  items,
  showBranch,
  showResources,
}: {
  items: AdminRecentAppointment[];
  showBranch?: boolean;
  showResources?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="نوبت اخیری نیست"
        description="وقتی نوبتی ثبت یا به‌روزرسانی شود، اینجا نمایش داده می‌شود."
      />
    );
  }

  return (
    <>
      <div className="admin-recent-table-wrap">
        <Table caption="نوبت‌های اخیر">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">زمان</TableHead>
              <TableHead scope="col">مشتری</TableHead>
              <TableHead scope="col">خدمت</TableHead>
              <TableHead scope="col">ارائه‌دهنده</TableHead>
              {showResources ? <TableHead scope="col">منبع</TableHead> : null}
              {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
              <TableHead scope="col">وضعیت نوبت</TableHead>
              <TableHead scope="col">وضعیت پرداخت</TableHead>
              <TableHead scope="col">اقدام</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const time = formatAppointmentParts(item.startsAt, item.timezone);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <time className="text-numeric ltr-value" dateTime={item.startsAt}>
                      {time?.label ?? item.startsAt}
                    </time>
                  </TableCell>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell>{item.serviceName}</TableCell>
                  <TableCell>{item.providerName ?? "—"}</TableCell>
                  {showResources ? <TableCell>{item.resourceName ?? "—"}</TableCell> : null}
                  {showBranch ? <TableCell>{item.branchName ?? "—"}</TableCell> : null}
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    {item.paymentStatus ? (
                      <StatusBadge status={item.paymentStatus} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={routes.admin.appointmentDetail(item.id)}>جزئیات</Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="admin-recent-cards" aria-label="نوبت‌های اخیر">
        {items.map((item) => (
          <RecentAppointmentCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
