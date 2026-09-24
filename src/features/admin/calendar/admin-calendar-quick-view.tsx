"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminAppointmentActions } from "@/features/admin/admin-appointment-actions";
import { useSession } from "@/features/auth/session-provider";
import { adminAppointmentDetailQueryOptions } from "@/lib/api/admin-appointments";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { hasPermission } from "@/lib/permissions/access";
import { toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminCalendarEventView } from "@/types/admin-calendar";

export function AdminCalendarQuickView({
  event,
  open,
  onClose,
  onRefreshCalendar,
}: {
  event: AdminCalendarEventView | null;
  open: boolean;
  onClose: () => void;
  onRefreshCalendar: () => void;
}) {
  const { user } = useSession();
  const userId = user?.id ?? "";
  const reference = event?.type === "appointment" ? event.appointmentReference : undefined;
  const canViewResources =
    hasPermission(user, "admin.resources.view") || (user?.permissionCodes.length ?? 0) === 0;

  const detailQuery = useQuery({
    ...adminAppointmentDetailQueryOptions(userId, reference ?? "_"),
    enabled: open && Boolean(reference) && Boolean(userId),
  });

  const title =
    event?.type === "blocked"
      ? "زمان مسدود"
      : event?.type === "time_off"
        ? "مرخصی / غیبت"
        : "نمای سریع نوبت";

  return (
    <Drawer open={open} onClose={onClose} title={title} placement="end">
      {!event ? null : event.type !== "appointment" ? (
        <div className="admin-calendar-quick-view">
          <dl className="booking-summary">
            <div>
              <dt>عنوان</dt>
              <dd>{event.title}</dd>
            </div>
            <div>
              <dt>زمان</dt>
              <dd className="ltr-value">
                {formatAppointmentParts(event.startsAt)?.label ?? event.startsAt}
              </dd>
            </div>
            {event.type === "blocked" && event.blockReason ? (
              <div>
                <dt>دلیل</dt>
                <dd>{event.blockReason}</dd>
              </div>
            ) : null}
            {event.type === "time_off" && event.timeOffLabel ? (
              <div>
                <dt>نوع</dt>
                <dd>{event.timeOffLabel}</dd>
              </div>
            ) : null}
            {event.staffName ? (
              <div>
                <dt>کارمند</dt>
                <dd>{event.staffName}</dd>
              </div>
            ) : null}
            {canViewResources && event.resourceName ? (
              <div>
                <dt>منبع</dt>
                <dd>{event.resourceName}</dd>
              </div>
            ) : null}
          </dl>
          <Button variant="secondary" onClick={onClose}>
            بستن
          </Button>
        </div>
      ) : !reference ? (
        <p className="ds-help">مرجع نوبت در دسترس نیست.</p>
      ) : detailQuery.isPending ? (
        <>
          <InlineLoading label="در حال بارگذاری جزئیات" />
          <Skeleton variant="card" />
        </>
      ) : detailQuery.isError ? (
        <ApiErrorState
          title="جزئیات نوبت دریافت نشد"
          description={toAppApiError(detailQuery.error).message}
          onRetry={() => void detailQuery.refetch()}
        />
      ) : detailQuery.data && user ? (
        <div className="admin-calendar-quick-view">
          <dl className="booking-summary">
            <div>
              <dt>مشتری</dt>
              <dd>{detailQuery.data.customer.name}</dd>
            </div>
            <div>
              <dt>خدمت</dt>
              <dd>{detailQuery.data.service.name}</dd>
            </div>
            <div>
              <dt>زمان</dt>
              <dd className="ltr-value">
                {formatAppointmentParts(detailQuery.data.startsAt, detailQuery.data.timezone)
                  ?.label ?? detailQuery.data.startsAt}
              </dd>
            </div>
            <div>
              <dt>وضعیت</dt>
              <dd>
                <StatusBadge status={detailQuery.data.status} />
              </dd>
            </div>
            {detailQuery.data.payment.status ? (
              <div>
                <dt>پرداخت</dt>
                <dd>
                  <StatusBadge status={detailQuery.data.payment.status} />
                </dd>
              </div>
            ) : null}
            {detailQuery.data.provider?.name ? (
              <div>
                <dt>متخصص</dt>
                <dd>{detailQuery.data.provider.name}</dd>
              </div>
            ) : null}
            {detailQuery.data.branch?.name ? (
              <div>
                <dt>شعبه</dt>
                <dd>{detailQuery.data.branch.name}</dd>
              </div>
            ) : null}
            {canViewResources && detailQuery.data.resources?.length ? (
              <div>
                <dt>منابع</dt>
                <dd>{detailQuery.data.resources.map((r) => r.name).join("، ")}</dd>
              </div>
            ) : null}
            <div>
              <dt>کد</dt>
              <dd className="ltr-value">{detailQuery.data.reference}</dd>
            </div>
          </dl>
          <AdminAppointmentActions
            view={detailQuery.data}
            user={user}
            userId={userId}
            onRefresh={() => {
              void detailQuery.refetch();
              onRefreshCalendar();
            }}
          />
          <Button asChild>
            <Link href={routes.admin.appointmentDetail(detailQuery.data.reference)}>
              مشاهده جزئیات کامل
            </Link>
          </Button>
        </div>
      ) : null}
    </Drawer>
  );
}
