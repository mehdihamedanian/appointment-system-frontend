"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { StatusBadge, Timeline, type TimelineItem } from "@/components/ui/data-display";
import { AdminAppointmentActions } from "@/features/admin/admin-appointment-actions";
import { AdminAppointmentInternalNote } from "@/features/admin/admin-appointment-internal-note";
import { AdminAppointmentDetailSkeleton } from "@/features/admin/admin-appointment-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminAppointmentDetailQueryOptions,
  adminAppointmentTimelineQueryOptions,
} from "@/lib/api/admin-appointments";
import { appointmentProviderLabel } from "@/lib/admin/appointment-adapter";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import { hasPermission } from "@/lib/permissions/access";
import { telHref } from "@/lib/public/links";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import type { AdminAppointmentDetailView } from "@/types/admin-appointment";
import type { CustomerTimelineEvent } from "@/types/appointment-detail";

function timelineItems(events: CustomerTimelineEvent[]): TimelineItem[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    meta: event.occurredAt,
    state: event.state,
  }));
}

function DetailSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-appointment-detail-section ds-card" aria-labelledby={id}>
      <h2 id={id} className="text-card-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AdminAppointmentDetailBody({
  view,
  timeline,
  timelineError,
  showResources,
  showCustomerContact,
  userId,
  user,
  onRefresh,
}: {
  view: AdminAppointmentDetailView;
  timeline: CustomerTimelineEvent[];
  timelineError?: boolean;
  showResources: boolean;
  showCustomerContact: boolean;
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  onRefresh: () => void;
}) {
  const parts = formatAppointmentParts(view.startsAt, view.timezone);
  const providerLabel = appointmentProviderLabel(view.provider);

  return (
    <div className="admin-appointment-detail">
      <DetailSection id="admin-appt-main" title="اطلاعات اصلی">
        <div className="admin-appointment-detail__badges">
          <StatusBadge status={view.status} />
          {view.payment.status ? <StatusBadge status={view.payment.status} /> : null}
        </div>
        <dl className="booking-summary-list">
          <div>
            <dt>کد رزرو</dt>
            <dd>
              <ReferenceCopy value={view.reference} label="رونوشت کد رزرو" successMessage="کد رزرو کپی شد." />
            </dd>
          </div>
          <div>
            <dt>خدمت</dt>
            <dd>{view.service.name}</dd>
          </div>
          {parts ? (
            <div>
              <dt>زمان</dt>
              <dd>
                <time dateTime={view.startsAt} className="text-numeric ltr-value">
                  {parts.label}
                </time>
              </dd>
            </div>
          ) : null}
          {view.durationMinutes ? (
            <div>
              <dt>مدت</dt>
              <dd>{formatDurationMinutes(view.durationMinutes)}</dd>
            </div>
          ) : null}
          {view.branch ? (
            <div>
              <dt>شعبه</dt>
              <dd>{view.branch.name}</dd>
            </div>
          ) : null}
          {providerLabel ? (
            <div>
              <dt>ارائه‌دهنده</dt>
              <dd>{providerLabel}</dd>
            </div>
          ) : null}
          {view.bookingSource ? (
            <div>
              <dt>منبع رزرو</dt>
              <dd>{view.bookingSource}</dd>
            </div>
          ) : null}
        </dl>
      </DetailSection>

      <DetailSection id="admin-appt-customer" title="مشتری">
        <p>{view.customer.name}</p>
        {showCustomerContact && view.customer.phone ? (
          <p>
            <a href={telHref(view.customer.phone)} className="ltr-value">
              {view.customer.phone}
            </a>
          </p>
        ) : null}
        {showCustomerContact && view.customer.email ? (
          <p className="ltr-value">{view.customer.email}</p>
        ) : null}
        {view.customer.contactMasked ? (
          <p className="text-caption">اطلاعات تماس از Backend ماسک شده است.</p>
        ) : null}
        {view.customer.profileHref ? (
          <Link href={view.customer.profileHref}>پروفایل مشتری</Link>
        ) : view.customer.id ? (
          <Link href={routes.admin.customers}>مشتریان</Link>
        ) : null}
      </DetailSection>

      <DetailSection id="admin-appt-payment" title="پرداخت">
        <dl className="booking-summary-list">
          {view.payment.totalLabel ? (
            <div>
              <dt>مبلغ</dt>
              <dd className="ltr-value">{view.payment.totalLabel}</dd>
            </div>
          ) : null}
          {view.payment.depositLabel ? (
            <div>
              <dt>بیعانه</dt>
              <dd className="ltr-value">{view.payment.depositLabel}</dd>
            </div>
          ) : null}
          {view.payment.paidLabel ? (
            <div>
              <dt>پرداخت‌شده</dt>
              <dd className="ltr-value">{view.payment.paidLabel}</dd>
            </div>
          ) : null}
          {view.payment.remainingLabel ? (
            <div>
              <dt>باقی‌مانده</dt>
              <dd className="ltr-value">{view.payment.remainingLabel}</dd>
            </div>
          ) : null}
          {view.payment.methodLabel ? (
            <div>
              <dt>روش</dt>
              <dd>{view.payment.methodLabel}</dd>
            </div>
          ) : null}
          {view.payment.transactionReference ? (
            <div>
              <dt>مرجع تراکنش</dt>
              <dd className="ltr-value">{view.payment.transactionReference}</dd>
            </div>
          ) : null}
          {view.payment.refundStatus ? (
            <div>
              <dt>بازپرداخت</dt>
              <dd>
                <StatusBadge status={view.payment.refundStatus} />
              </dd>
            </div>
          ) : null}
        </dl>
        {"paymentHref" in view.payment && view.payment.paymentHref ? (
          <Link href={view.payment.paymentHref}>جزئیات پرداخت</Link>
        ) : view.payment.transactionReference ? (
          <Link href={routes.admin.payments}>پرداخت‌ها</Link>
        ) : null}
      </DetailSection>

      {showResources && view.resources && view.resources.length > 0 ? (
        <DetailSection id="admin-appt-resources" title="منابع عملیاتی">
          <ul className="admin-appointment-resources">
            {view.resources.map((resource) => (
              <li key={resource.id}>
                {resource.name}
                {resource.type ? <span className="text-caption"> ({resource.type})</span> : null}
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}

      {view.customerNote ? (
        <DetailSection id="admin-appt-customer-note" title="یادداشت مشتری">
          <p>{view.customerNote}</p>
        </DetailSection>
      ) : null}

      <AdminAppointmentInternalNote view={view} user={user} userId={userId} onSaved={onRefresh} />

      <DetailSection id="admin-appt-timeline" title="خط زمانی">
        {timelineError ? (
          <p className="text-caption">خط زمانی بارگذاری نشد.</p>
        ) : timeline.length > 0 ? (
          <Timeline items={timelineItems(timeline)} />
        ) : view.timeline && view.timeline.length > 0 ? (
          <Timeline items={timelineItems(view.timeline)} />
        ) : (
          <p className="text-caption">رویدادی ثبت نشده است.</p>
        )}
      </DetailSection>

      <AdminAppointmentActions view={view} user={user} userId={userId} onRefresh={onRefresh} />
    </div>
  );
}

export function AdminAppointmentDetailScreen({ reference }: { reference: string }) {
  const { status, user } = useSession();
  const userId = user?.id;
  const safeReference = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(userId);

  const detailQuery = useQuery({
    ...adminAppointmentDetailQueryOptions(userId ?? "anonymous", safeReference),
    enabled: sessionReady && Boolean(safeReference),
  });

  const timelineQuery = useQuery({
    ...adminAppointmentTimelineQueryOptions(userId ?? "anonymous", safeReference),
    enabled: sessionReady && Boolean(safeReference) && Boolean(detailQuery.data),
  });

  const showResources = hasPermission(user, "admin.resources.view");
  const showCustomerContact =
    hasPermission(user, "admin.customers.view") || user?.permissionCodes.length === 0;

  if (!safeReference) {
    return <NoResultsState title="شناسه نوبت نامعتبر است" description="آدرس درخواستی معتبر نیست." />;
  }

  if (status === "loading" || !sessionReady) {
    return <AdminAppointmentDetailSkeleton />;
  }

  const refresh = () => {
    void detailQuery.refetch();
    void timelineQuery.refetch();
  };

  return (
    <PermissionGate permission="admin.appointments.view">
      <AdminPageHeader
        title="جزئیات نوبت"
        description="اطلاعات عملیاتی، پرداخت و اقدامات مجاز."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.appointmentDetail(safeReference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.appointments, label: "نوبت‌ها" },
              { label: "جزئیات" },
            ]}
          />
        }
        secondaryActions={
          <Link href={routes.admin.appointments} className="btn btn--ghost btn--sm">
            <ArrowRight className="icon-dir" size={16} aria-hidden="true" />
            بازگشت
          </Link>
        }
      />

      {detailQuery.isPending ? <AdminAppointmentDetailSkeleton /> : null}

      {detailQuery.isError || (!detailQuery.isPending && !detailQuery.data) ? (
        (() => {
          const error = toAppApiError(detailQuery.error);
          if (isForbiddenError(error)) {
            return (
              <PermissionDeniedState description="مجوز لازم برای مشاهده این نوبت را ندارید." />
            );
          }
          if (isSessionExpiredError(error)) {
            return (
              <ApiErrorState
                title="نشست منقضی شده"
                description={error.message}
                onRetry={() => {
                  window.location.href = routes.auth.sessionExpired;
                }}
              />
            );
          }
          if (isNotFoundError(error)) {
            return (
              <NoResultsState
                title="نوبت پیدا نشد"
                description="این نوبت وجود ندارد یا endpoint Backend هنوز فعال نیست."
              />
            );
          }
          return (
            <ApiErrorState
              title="جزئیات بارگذاری نشد"
              description={error.message}
              requestId={error.requestId}
              onRetry={refresh}
            />
          );
        })()
      ) : null}

      {detailQuery.data && user ? (
        <AdminAppointmentDetailBody
          view={detailQuery.data}
          timeline={timelineQuery.data ?? []}
          timelineError={timelineQuery.isError}
          showResources={showResources}
          showCustomerContact={showCustomerContact && !detailQuery.data.customer.contactMasked}
          userId={userId!}
          user={user}
          onRefresh={refresh}
        />
      ) : null}
    </PermissionGate>
  );
}
