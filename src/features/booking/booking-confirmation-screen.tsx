"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { StatusBadge } from "@/components/ui/data-display";
import {
  ApiErrorState,
  NoResultsState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { useSession } from "@/features/auth/session-provider";
import { bookingConfirmationQueryOptions } from "@/lib/api/booking";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import {
  confirmationHeadline,
  confirmationProviderLabel,
  confirmationResultKind,
} from "@/lib/booking/confirmation-adapter";
import { invalidateAfterBookingResult } from "@/lib/booking/confirmation-cache";
import { markBookingDraftCompleted } from "@/lib/booking/persistence";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { BookingConfirmationView } from "@/types/confirmation";

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ConfirmationSkeleton() {
  return (
    <div className="booking-confirmation" aria-busy="true" aria-label="در حال بررسی وضعیت رزرو">
      <Skeleton variant="card" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </div>
  );
}

function ConfirmationDetails({ view }: { view: BookingConfirmationView }) {
  const parts = formatAppointmentParts(view.startsAt, view.timezone);
  const endParts = view.endsAt ? formatAppointmentParts(view.endsAt, view.timezone) : null;
  const providerLabel = confirmationProviderLabel(view.provider);
  const { totalLabel, paidLabel, remainingLabel } = view.pricing;

  return (
    <section className="booking-confirmation-card" aria-labelledby="booking-confirmation-details">
      <h2 id="booking-confirmation-details" className="text-card-title">
        جزئیات نوبت
      </h2>
      <dl className="booking-summary-list">
        {view.reference ? (
          <SummaryRow term="کد پیگیری">
            <ReferenceCopy value={view.reference} />
          </SummaryRow>
        ) : null}
        <SummaryRow term="خدمت">{view.serviceName}</SummaryRow>
        {providerLabel ? <SummaryRow term="متخصص">{providerLabel}</SummaryRow> : null}
        {view.branch ? (
          <SummaryRow term="شعبه">
            {view.branch.name}
            {view.branch.address ? <span> — {view.branch.address}</span> : null}
          </SummaryRow>
        ) : null}
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
        {view.paymentStatus ? (
          <SummaryRow term="وضعیت پرداخت">
            <StatusBadge status={view.paymentStatus} />
          </SummaryRow>
        ) : null}
        {totalLabel ? (
          <SummaryRow term="مبلغ کل">
            <strong className="booking-money booking-money--total ltr-value">{totalLabel}</strong>
          </SummaryRow>
        ) : null}
        {paidLabel ? (
          <SummaryRow term="پرداخت‌شده">
            <span className="booking-money ltr-value">{paidLabel}</span>
          </SummaryRow>
        ) : null}
        {remainingLabel ? (
          <SummaryRow term="مانده">
            <span className="booking-money ltr-value">{remainingLabel}</span>
          </SummaryRow>
        ) : null}
        {view.transactionReference ? (
          <SummaryRow term="شماره پیگیری پرداخت">
            <span className="ltr-value">{view.transactionReference}</span>
          </SummaryRow>
        ) : null}
        {view.instructions ? <SummaryRow term="راهنما">{view.instructions}</SummaryRow> : null}
      </dl>
    </section>
  );
}

export function BookingConfirmationScreen({ reference }: { reference: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const { user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const query = useQuery(bookingConfirmationQueryOptions(safe));
  const cleaned = useRef(false);

  useEffect(() => {
    if (!query.data || cleaned.current) {
      return;
    }
    cleaned.current = true;
    markBookingDraftCompleted(query.data.reference ?? query.data.id);
    invalidateAfterBookingResult(queryClient, user?.id);
  }, [query.data, queryClient, user?.id]);

  useEffect(() => {
    if (query.data) {
      headingRef.current?.focus();
    }
  }, [query.data]);

  if (!safe) {
    return (
      <NoResultsState
        title="رزرو پیدا نشد"
        description="شناسه پیگیری معتبر نیست. نوبت جدیدی ساخته نشد."
      />
    );
  }

  if (query.isPending) {
    return <ConfirmationSkeleton />;
  }

  if (query.isError) {
    const error = toAppApiError(query.error);
    if (isSessionExpiredError(error)) {
      return (
        <SessionExpiredState
          description="نشست شما پایان یافته است. پس از ورود دوباره، وضعیت رزرو از همین پیوند قابل بررسی است."
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
          title="رزرو پیدا نشد"
          description="این رزرو در دسترس نیست. نوبت جدیدی ساخته نشد."
        />
      );
    }
    return (
      <ApiErrorState
        title="دریافت وضعیت رزرو ممکن نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const view = query.data;
  const kind = confirmationResultKind(view);
  const headline = confirmationHeadline(kind);

  return (
    <div className="booking-confirmation">
      <header className="booking-confirmation__hero">
        <p className="text-caption" role="status">
          {headline.showSuccessIcon ? "رزرو تأیید شد" : "وضعیت رزرو"}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-page-title">
          {headline.title}
        </h1>
        <p>{headline.description}</p>
        <div className="booking-confirmation__badges">
          <StatusBadge status={view.status} />
          {view.paymentStatus ? <StatusBadge status={view.paymentStatus} /> : null}
        </div>
      </header>

      {kind === "pay_at_location" ? (
        <Alert
          tone="info"
          title="پرداخت در محل"
          description={
            view.pricing.remainingLabel
              ? `مانده اعلام‌شده توسط سرویس: ${view.pricing.remainingLabel}`
              : "مبلغ هنگام مراجعه به مجموعه پرداخت می‌شود."
          }
        />
      ) : null}
      {kind === "payment_pending" ? (
        <Alert
          tone="warning"
          title="پرداخت هنوز نهایی نشده است"
          description="تا تأیید سرویس پرداخت، این صفحه موفقیت قطعی نشان نمی‌دهد."
        />
      ) : null}

      <ConfirmationDetails view={view} />

      <div className="booking-confirmation__actions">
        <Button asChild>
          <Link href={routes.customer.dashboard}>بازگشت به داشبورد</Link>
        </Button>
        {view.branch?.directionsUrl ? (
          <Button variant="secondary" asChild>
            <a href={view.branch.directionsUrl} target="_blank" rel="noopener noreferrer">
              مسیر
            </a>
          </Button>
        ) : null}
        {view.branch?.phone ? (
          <Button variant="secondary" asChild>
            <a href={`tel:${view.branch.phone}`}>تماس با مجموعه</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
