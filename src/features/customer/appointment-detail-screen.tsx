"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge, Timeline, type TimelineItem } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import {
  ApiErrorState,
  NoResultsState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { PageHeader } from "@/components/layout/page-header";
import { AppointmentContactBusiness } from "@/features/customer/appointment-contact-business";
import { AppointmentDetailSkeleton } from "@/features/customer/appointment-detail-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  customerAppointmentDetailQueryOptions,
  customerAppointmentTimelineQueryOptions,
} from "@/lib/api/appointments";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { appointmentProviderLabel } from "@/lib/customer/appointment-detail-adapter";
import { repeatBookingHrefFromDetail } from "@/lib/customer/repeat-booking";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import { directionsHref, EXTERNAL_LINK_REL, telHref } from "@/lib/public/links";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes, LOGIN_PATH } from "@/constants/routes";
import {
  APPOINTMENT_CANCEL_ENABLED,
  APPOINTMENT_RESCHEDULE_ENABLED,
  APPOINTMENT_REVIEW_ENABLED,
} from "@/types/appointment-list";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import type {
  CustomerAppointmentDetailView,
  CustomerTimelineEvent,
  PolicySnapshot,
} from "@/types/appointment-detail";

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function PolicySection({
  id,
  title,
  policy,
}: {
  id: string;
  title: string;
  policy: PolicySnapshot;
}) {
  return (
    <section className="appointment-detail-card" aria-labelledby={id}>
      <h2 id={id} className="text-card-title">
        {policy.title ?? title}
      </h2>
      {policy.summary ? <p>{policy.summary}</p> : null}
      <dl className="booking-summary-list">
        {policy.deadlineLabel ? (
          <SummaryRow term="مهلت">
            <span>{policy.deadlineLabel}</span>
          </SummaryRow>
        ) : null}
        {policy.feeLabel ? (
          <SummaryRow term="هزینه">
            <span className="ltr-value">{policy.feeLabel}</span>
          </SummaryRow>
        ) : null}
        {policy.refundLabel ? (
          <SummaryRow term="بازپرداخت">
            <span>{policy.refundLabel}</span>
          </SummaryRow>
        ) : null}
      </dl>
      {policy.policyUrl ? (
        <p>
          <a href={policy.policyUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
            مشاهده سیاست کامل
          </a>
        </p>
      ) : null}
    </section>
  );
}

function timelineItems(events: CustomerTimelineEvent[]): TimelineItem[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    meta: event.occurredAt,
    state: event.state,
  }));
}

function AppointmentStatusSummary({ view }: { view: CustomerAppointmentDetailView }) {
  const parts = formatAppointmentParts(view.startsAt, view.timezone);
  const endParts = view.endsAt ? formatAppointmentParts(view.endsAt, view.timezone) : null;
  const providerLabel = appointmentProviderLabel(view.provider);

  return (
    <section className="appointment-detail-card appointment-detail-card--summary" aria-labelledby="appointment-status">
      <h2 id="appointment-status" className="visually-hidden">
        وضعیت فعلی نوبت
      </h2>
      <div className="appointment-detail__badges">
        <StatusBadge status={view.status} />
        {view.payment.status ? <StatusBadge status={view.payment.status} /> : null}
      </div>
      {parts ? (
        <p className="appointment-detail__when">
          <time dateTime={view.startsAt}>{parts.label}</time>
        </p>
      ) : null}
      {endParts?.time ? (
        <p className="text-caption">
          پایان: <span className="ltr-value">{endParts.time}</span>
        </p>
      ) : null}
      {view.durationMinutes ? <p>{formatDurationMinutes(view.durationMinutes)}</p> : null}
      {providerLabel ? <p>{providerLabel}</p> : null}
      <div className="text-caption">
        <span>کد رزرو: </span>
        <ReferenceCopy value={view.publicReference} label="رونوشت کد رزرو" successMessage="کد رزرو کپی شد." />
      </div>
    </section>
  );
}

function AppointmentDetailsSection({ view }: { view: CustomerAppointmentDetailView }) {
  const parts = formatAppointmentParts(view.startsAt, view.timezone);
  const endParts = view.endsAt ? formatAppointmentParts(view.endsAt, view.timezone) : null;
  const providerLabel = appointmentProviderLabel(view.provider);

  return (
    <section className="appointment-detail-card" aria-labelledby="appointment-details">
      <h2 id="appointment-details" className="text-card-title">
        جزئیات نوبت
      </h2>
      <dl className="booking-summary-list">
        <SummaryRow term="خدمت">
          <span>{view.service.name}</span>
          {view.service.description ? <p className="text-caption">{view.service.description}</p> : null}
        </SummaryRow>
        {providerLabel ? <SummaryRow term="متخصص">{providerLabel}</SummaryRow> : null}
        <SummaryRow term="تاریخ">{parts?.date ?? <span className="ltr-value">{view.startsAt}</span>}</SummaryRow>
        <SummaryRow term="ساعت">
          <span className="ltr-value">{parts?.time}</span>
          {endParts?.time ? (
            <>
              {" "}
              تا <span className="ltr-value">{endParts.time}</span>
            </>
          ) : null}
        </SummaryRow>
        {view.durationMinutes ? (
          <SummaryRow term="مدت">{formatDurationMinutes(view.durationMinutes)}</SummaryRow>
        ) : null}
        {view.timezone ? (
          <SummaryRow term="منطقه زمانی">
            <span className="ltr-value">{view.timezone}</span>
          </SummaryRow>
        ) : null}
        <SummaryRow term="وضعیت نوبت">
          <StatusBadge status={view.status} />
        </SummaryRow>
      </dl>
      {view.service.imageUrl ? (
        <img
          src={view.service.imageUrl}
          alt=""
          className="appointment-detail__service-image"
          loading="lazy"
        />
      ) : null}
    </section>
  );
}

function AppointmentLocationSection({ view }: { view: CustomerAppointmentDetailView }) {
  if (!view.branch) {
    return null;
  }
  const title = view.singleBranch ? "محل مراجعه" : "شعبه";
  const tel = view.branch.phone ? telHref(view.branch.phone) : undefined;
  const directions = directionsHref(view.branch.address, view.branch.directionsUrl);

  return (
    <section className="appointment-detail-card" aria-labelledby="appointment-location">
      <h2 id="appointment-location" className="text-card-title">
        {title}
      </h2>
      <dl className="booking-summary-list">
        <SummaryRow term="نام">{view.branch.name}</SummaryRow>
        {view.branch.address ? <SummaryRow term="نشانی">{view.branch.address}</SummaryRow> : null}
        {view.branch.visitInstructions ? (
          <SummaryRow term="راهنمای مراجعه">{view.branch.visitInstructions}</SummaryRow>
        ) : null}
        {tel ? (
          <SummaryRow term="تلفن">
            <a href={tel} className="ltr-value">
              {view.branch.phone}
            </a>
          </SummaryRow>
        ) : null}
      </dl>
      {directions ? (
        <p>
          <a href={directions} target="_blank" rel={EXTERNAL_LINK_REL}>
            مسیر و نقشه
          </a>
        </p>
      ) : null}
    </section>
  );
}

function AppointmentPaymentSection({
  view,
  error,
  onRetry,
}: {
  view: CustomerAppointmentDetailView;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { payment } = view;

  return (
    <section className="appointment-detail-card" aria-labelledby="appointment-payment">
      <h2 id="appointment-payment" className="text-card-title">
        خلاصه پرداخت
      </h2>
      {error ? (
        <Alert
          tone="warning"
          title="اطلاعات پرداخت کامل دریافت نشد"
          description="جزئیات اصلی نوبت نمایش داده می‌شود. می‌توانید دوباره تلاش کنید."
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                تلاش دوباره
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <dl className="booking-summary-list">
        {payment.status ? (
          <SummaryRow term="وضعیت پرداخت">
            <StatusBadge status={payment.status} />
          </SummaryRow>
        ) : null}
        {payment.totalLabel ? (
          <SummaryRow term="مبلغ کل">
            <strong className="booking-money booking-money--total ltr-value">{payment.totalLabel}</strong>
          </SummaryRow>
        ) : null}
        {payment.paidLabel ? (
          <SummaryRow term="پرداخت‌شده">
            <span className="booking-money ltr-value">{payment.paidLabel}</span>
          </SummaryRow>
        ) : null}
        {payment.depositLabel ? (
          <SummaryRow term="بیعانه">
            <span className="booking-money ltr-value">{payment.depositLabel}</span>
          </SummaryRow>
        ) : null}
        {payment.remainingLabel ? (
          <SummaryRow term="مانده">
            <span className="booking-money ltr-value">{payment.remainingLabel}</span>
          </SummaryRow>
        ) : null}
        {payment.methodLabel ? <SummaryRow term="روش پرداخت">{payment.methodLabel}</SummaryRow> : null}
        {payment.transactionReference ? (
          <SummaryRow term="شماره پیگیری پرداخت">
            <span className="ltr-value">{payment.transactionReference}</span>
          </SummaryRow>
        ) : null}
        {payment.refundStatus ? (
          <SummaryRow term="وضعیت بازپرداخت">
            <StatusBadge status={payment.refundStatus} />
          </SummaryRow>
        ) : null}
        {payment.receiptUrl ? (
          <SummaryRow term="رسید">
            <a href={payment.receiptUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
              مشاهده رسید
            </a>
          </SummaryRow>
        ) : null}
      </dl>
    </section>
  );
}

function AppointmentActionsPanel({
  view,
  repeatHref,
}: {
  view: CustomerAppointmentDetailView;
  repeatHref?: string;
}) {
  const router = useRouter();
  const { actions } = view;
  const processing = actions.processing === true;
  const showPay = actions.canPay && Boolean(actions.payHref);
  const showRepeat = actions.canRepeat && Boolean(repeatHref);
  const showCancel = APPOINTMENT_CANCEL_ENABLED && actions.canCancel;
  const showReschedule = APPOINTMENT_RESCHEDULE_ENABLED && actions.canReschedule;
  const showReview =
    APPOINTMENT_REVIEW_ENABLED &&
    isCapabilityVisible(defaultCapabilities, "reviews") &&
    actions.canReview;
  const hasActions = showPay || showRepeat || showCancel || showReschedule || showReview;

  if (
    !hasActions &&
    !actions.blockedReason &&
    !actions.cancelBlockedReason &&
    !actions.rescheduleBlockedReason &&
    !actions.reviewBlockedReason
  ) {
    return null;
  }

  return (
    <section className="appointment-detail-card appointment-detail-card--actions" aria-labelledby="appointment-actions">
      <h2 id="appointment-actions" className="text-card-title">
        اقدامات
      </h2>
      <div className="appointment-detail__actions">
        {showPay && !processing ? (
          <Button asChild>
            <Link href={actions.payHref!}>ادامه پرداخت</Link>
          </Button>
        ) : null}
        {showPay && processing ? (
          <Button disabled>ادامه پرداخت</Button>
        ) : null}
        {showReview && !processing ? (
          <Button asChild>
            <Link href={routes.customer.appointmentReview(view.publicReference)}>ثبت نظر</Link>
          </Button>
        ) : null}
        {showRepeat && repeatHref ? (
          <Button variant="secondary" onClick={() => router.push(repeatHref)}>
            رزرو دوباره
          </Button>
        ) : null}
        {showReschedule ? (
          actions.rescheduleBlockedReason || processing ? (
            <Button variant="secondary" disabled>
              زمان‌بندی مجدد
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link href={routes.customer.appointmentReschedule(view.publicReference)}>
                زمان‌بندی مجدد
              </Link>
            </Button>
          )
        ) : null}
        {showCancel ? (
          actions.cancelBlockedReason || processing ? (
            <Button variant="destructive" disabled>
              لغو نوبت
            </Button>
          ) : (
            <Button variant="destructive" asChild>
              <Link href={routes.customer.appointmentCancel(view.publicReference)}>لغو نوبت</Link>
            </Button>
          )
        ) : null}
      </div>
      {actions.rescheduleBlockedReason ? (
        <p className="text-caption">{actions.rescheduleBlockedReason}</p>
      ) : null}
      {actions.cancelBlockedReason ? (
        <p className="text-caption">{actions.cancelBlockedReason}</p>
      ) : null}
      {actions.reviewBlockedReason ? (
        <p className="text-caption">{actions.reviewBlockedReason}</p>
      ) : null}
      {actions.blockedReason ? <p className="text-caption">{actions.blockedReason}</p> : null}
    </section>
  );
}

export function AppointmentDetailScreen({ reference }: { reference: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const statusAnnouncerRef = useRef<HTMLSpanElement>(null);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";

  const detailQuery = useQuery({
    ...customerAppointmentDetailQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe),
  });

  const timelineQuery = useQuery({
    ...customerAppointmentTimelineQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe) && detailQuery.isSuccess,
  });

  useEffect(() => {
    if (detailQuery.data) {
      headingRef.current?.focus();
    }
  }, [detailQuery.data]);

  useEffect(() => {
    const current = detailQuery.data?.status;
    if (!current) {
      return;
    }
    if (previousStatusRef.current && previousStatusRef.current !== current) {
      setStatusAnnouncement("وضعیت نوبت به‌روز شد.");
      statusAnnouncerRef.current?.focus();
    }
    previousStatusRef.current = current;
  }, [detailQuery.data?.status]);

  if (!safe) {
    return (
      <NoResultsState
        title="نوبت پیدا نشد"
        description="شناسه نوبت معتبر نیست."
      />
    );
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="appointment-detail">
        <PageHeader
          title="جزئیات نوبت"
          description="جزئیات نوبت پس از ورود نمایش داده می‌شود."
          breadcrumb={
            <Link href={routes.customer.appointments} className="appointment-detail__back">
              <ArrowRight size={16} aria-hidden="true" />
              بازگشت به نوبت‌های من
            </Link>
          }
        />
        <AppointmentDetailSkeleton />
      </div>
    );
  }

  if (detailQuery.isPending) {
    return (
      <div className="appointment-detail">
        <PageHeader
          title="جزئیات نوبت"
          breadcrumb={
            <Link href={routes.customer.appointments} className="appointment-detail__back">
              <ArrowRight size={16} aria-hidden="true" />
              بازگشت به نوبت‌های من
            </Link>
          }
        />
        <AppointmentDetailSkeleton />
      </div>
    );
  }

  if (detailQuery.isError) {
    const error = toAppApiError(detailQuery.error);
    if (isSessionExpiredError(error)) {
      return (
        <SessionExpiredState
          description="نشست شما پایان یافته است. پس از ورود دوباره، جزئیات نوبت از همین پیوند قابل بررسی است."
          action={
            <Button asChild>
              <Link href={LOGIN_PATH}>ورود</Link>
            </Button>
          }
        />
      );
    }
    if (isNotFoundError(error) || isForbiddenError(error)) {
      return (
        <NoResultsState
          title="نوبت پیدا نشد"
          description="این نوبت در دسترس نیست."
        />
      );
    }
    return (
      <ApiErrorState
        title="دریافت جزئیات نوبت ممکن نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const view = detailQuery.data;
  const repeatHref = view.actions.canRepeat ? repeatBookingHrefFromDetail(view) : undefined;
  const timelineEvents =
    timelineQuery.data && timelineQuery.data.length > 0
      ? timelineQuery.data
      : view.embeddedTimeline ?? [];
  const timelineError = timelineQuery.isError && !view.embeddedTimeline?.length;

  return (
    <div className="appointment-detail">
      <PageHeader
        title="جزئیات نوبت"
        description={view.service.name}
        breadcrumb={
          <Link href={routes.customer.appointments} className="appointment-detail__back">
            <ArrowRight size={16} aria-hidden="true" />
            بازگشت به نوبت‌های من
          </Link>
        }
      />
      <span ref={statusAnnouncerRef} tabIndex={-1} className="visually-hidden" aria-live="polite">
        {statusAnnouncement}
      </span>

      <div className="appointment-detail__layout">
        <div className="appointment-detail__main">
          <div className="appointment-detail__mobile-only">
            <AppointmentStatusSummary view={view} />
          </div>
          <AppointmentDetailsSection view={view} />
          <AppointmentLocationSection view={view} />
          <div className="appointment-detail__mobile-only">
            <AppointmentPaymentSection view={view} />
          </div>
          {view.customerNote ? (
            <section className="appointment-detail-card" aria-labelledby="appointment-note">
              <h2 id="appointment-note" className="text-card-title">
                یادداشت شما
              </h2>
              <p>{view.customerNote}</p>
            </section>
          ) : null}
          <section className="appointment-detail-card" aria-labelledby="appointment-timeline">
            <h2 id="appointment-timeline" className="text-card-title">
              تاریخچه وضعیت
            </h2>
            {timelineQuery.isPending && timelineEvents.length === 0 ? (
              <p className="text-caption">در حال بارگذاری تاریخچه…</p>
            ) : null}
            {timelineError ? (
              <Alert
                tone="warning"
                title="تاریخچه وضعیت دریافت نشد"
                description="جزئیات اصلی نوبت همچنان نمایش داده می‌شود."
                action={
                  <Button variant="secondary" onClick={() => void timelineQuery.refetch()}>
                    تلاش دوباره
                  </Button>
                }
              />
            ) : null}
            {timelineEvents.length > 0 ? <Timeline items={timelineItems(timelineEvents)} /> : null}
            {!timelineQuery.isPending && !timelineError && timelineEvents.length === 0 ? (
              <p className="text-caption">تاریخچه‌ای برای نمایش وجود ندارد.</p>
            ) : null}
          </section>
          {view.cancellationPolicy ? (
            <PolicySection id="appointment-cancel-policy" title="سیاست لغو" policy={view.cancellationPolicy} />
          ) : null}
          {view.reschedulePolicy ? (
            <PolicySection
              id="appointment-reschedule-policy"
              title="سیاست زمان‌بندی مجدد"
              policy={view.reschedulePolicy}
            />
          ) : null}
          {view.contact ? <AppointmentContactBusiness contact={view.contact} /> : null}
        </div>

        <aside className="appointment-detail__aside">
          <div className="appointment-detail__desktop-only">
            <section className="appointment-detail-card appointment-detail-card--aside-status" aria-labelledby="appointment-aside-status">
              <h2 id="appointment-aside-status" className="text-card-title">
                وضعیت فعلی
              </h2>
              <div className="appointment-detail__badges">
                <StatusBadge status={view.status} />
                {view.payment.status ? <StatusBadge status={view.payment.status} /> : null}
              </div>
              <dl className="booking-summary-list">
                <SummaryRow term="کد رزرو">
                  <ReferenceCopy value={view.publicReference} label="رونوشت کد رزرو" successMessage="کد رزرو کپی شد." />
                </SummaryRow>
                {formatAppointmentParts(view.startsAt, view.timezone) ? (
                  <SummaryRow term="زمان">
                    <time dateTime={view.startsAt}>
                      {formatAppointmentParts(view.startsAt, view.timezone)?.label}
                    </time>
                  </SummaryRow>
                ) : null}
              </dl>
            </section>
            <AppointmentPaymentSection view={view} />
            <AppointmentActionsPanel view={view} repeatHref={repeatHref} />
          </div>
        </aside>
      </div>

      <div className="appointment-detail__mobile-actions appointment-detail__mobile-only">
        <AppointmentActionsPanel view={view} repeatHref={repeatHref} />
      </div>
    </div>
  );
}
