"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert, Spinner } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  NoResultsState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { useSession } from "@/features/auth/session-provider";
import { customerAppointmentDetailQueryOptions } from "@/lib/api/appointments";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { createPaymentSession, paymentNavigation } from "@/lib/api/payment";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { isAlreadyPaidError, isAlreadyProcessingError } from "@/lib/payment/errors";
import { paymentIdempotencyKey, paymentIntentFingerprint } from "@/lib/payment/idempotency";
import { getSafeGatewayRedirect } from "@/lib/payment/safe-gateway-url";
import { writePaymentReference } from "@/lib/payment/session-store";
import { isSafePublicId } from "@/lib/public/booking-href";
import { LOGIN_PATH, routes } from "@/constants/routes";
import type { AppApiError } from "@/types/api";

/** Online payment for an already booked appointment; the amount is set by the Backend intent. */
export function AppointmentPaymentScreen({ reference }: { reference: string }) {
  const router = useRouter();
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";
  const submitLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<AppApiError>();

  const detailQuery = useQuery({
    ...customerAppointmentDetailQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe),
  });
  const view = detailQuery.data;

  const backLink = (
    <Link href={routes.customer.appointmentDetail(safe)} className="appointment-detail__back">
      <ArrowRight size={16} aria-hidden="true" />
      بازگشت به جزئیات نوبت
    </Link>
  );

  async function onPay() {
    if (!view?.appointmentId || submitLock.current) {
      return;
    }
    submitLock.current = true;
    setCreating(true);
    setActionError(undefined);
    try {
      const fingerprint = paymentIntentFingerprint({ quoteId: view.appointmentId, method: "full" });
      const result = await createPaymentSession(
        { method: "full", bookingReference: view.appointmentId },
        paymentIdempotencyKey(idempotencyRef, fingerprint),
      );
      if (result.outcome === "missing_endpoint") {
        setActionError({ status: 404, message: "پرداخت آنلاین این نوبت در سرویس در دسترس نیست." });
        return;
      }
      const session = result.session;
      const resultHref = `${routes.customer.bookingPaymentResult}?ref=${session.paymentId}`;
      if (session.status !== "redirect_required") {
        writePaymentReference({ paymentReference: session.paymentId });
        router.replace(resultHref);
        return;
      }
      const redirectUrl = getSafeGatewayRedirect(session.redirectUrl);
      if (!redirectUrl) {
        setActionError({
          status: 422,
          code: "UNSAFE_GATEWAY_URL",
          message: "نشانی درگاه پرداخت معتبر یا مجاز نبود. به درگاه منتقل نشدید.",
        });
        return;
      }
      writePaymentReference({ paymentReference: session.paymentId });
      setRedirecting(true);
      paymentNavigation.assign(redirectUrl);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAlreadyPaidError(normalized) || isAlreadyProcessingError(normalized)) {
        await detailQuery.refetch();
      }
      setActionError(normalized);
    } finally {
      submitLock.current = false;
      setCreating(false);
    }
  }

  if (!safe) {
    return <NoResultsState title="نوبت پیدا نشد" description="شناسه نوبت معتبر نیست." />;
  }

  if (!sessionReady || detailQuery.isPending) {
    return (
      <div className="booking-payment" role="status" aria-busy="true" aria-label="در حال بارگذاری پرداخت">
        <PageHeader title="پرداخت نوبت" breadcrumb={backLink} />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (detailQuery.isError) {
    const error = toAppApiError(detailQuery.error);
    if (isSessionExpiredError(error)) {
      return (
        <SessionExpiredState
          description="نشست شما پایان یافته است."
          action={
            <Button asChild>
              <Link href={LOGIN_PATH}>ورود</Link>
            </Button>
          }
        />
      );
    }
    if (isForbiddenError(error) || isNotFoundError(error)) {
      return <NoResultsState title="نوبت پیدا نشد" description="این نوبت در دسترس نیست." />;
    }
    return (
      <ApiErrorState
        title="دریافت اطلاعات پرداخت ممکن نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  if (!view) {
    return null;
  }

  const when = formatAppointmentParts(view.startsAt, view.timezone);
  const payable = view.actions.canPay && Boolean(view.appointmentId);

  return (
    <div className="booking-payment">
      <PageHeader
        title="پرداخت نوبت"
        description="مبلغ قابل پرداخت را سرویس نوبت‌دهی هنگام ایجاد پرداخت تعیین می‌کند."
        breadcrumb={backLink}
      />
      <span className="visually-hidden" aria-live="polite">
        {creating ? "در حال ایجاد درخواست پرداخت." : ""}
        {redirecting ? "در حال انتقال به درگاه پرداخت." : ""}
      </span>
      {actionError ? (
        <Alert
          tone="error"
          title="پرداخت انجام نشد"
          description={
            actionError.requestId
              ? `${actionError.message} شناسه درخواست: ${actionError.requestId}`
              : actionError.message
          }
        />
      ) : null}
      {redirecting ? (
        <Alert tone="info" title="در حال انتقال به درگاه پرداخت" description="لطفاً این صفحه را نبندید." />
      ) : null}
      {!payable ? (
        <Alert
          tone="warning"
          title="پرداخت آنلاین برای این نوبت در دسترس نیست"
          description="ممکن است این نوبت قبلاً پرداخت شده یا وضعیت آن اجازه پرداخت ندهد."
        />
      ) : null}
      <section className="slot-hold-card" aria-labelledby="appointment-payment-summary">
        <h2 id="appointment-payment-summary" className="text-card-title">
          {view.service.name}
        </h2>
        <dl className="booking-summary-list">
          {when?.label ? (
            <div>
              <dt>زمان نوبت</dt>
              <dd>{when.label}</dd>
            </div>
          ) : null}
          <div>
            <dt>کد رزرو</dt>
            <dd>
              <span className="ltr-value">{view.publicReference}</span>
            </dd>
          </div>
          {view.payment.totalLabel ? (
            <div>
              <dt>مبلغ کل</dt>
              <dd className="ltr-value booking-money">{view.payment.totalLabel}</dd>
            </div>
          ) : null}
          {view.payment.paidLabel ? (
            <div>
              <dt>پرداخت‌شده</dt>
              <dd className="ltr-value booking-money">{view.payment.paidLabel}</dd>
            </div>
          ) : null}
          {view.payment.remainingLabel ? (
            <div>
              <dt>مانده قابل پرداخت</dt>
              <dd>
                <strong className="ltr-value booking-money">{view.payment.remainingLabel}</strong>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
      <div className="booking-payment__actions">
        {payable ? (
          <Button
            onClick={() => void onPay()}
            loading={creating || redirecting}
            disabled={creating || redirecting}
          >
            پرداخت آنلاین
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به جزئیات نوبت</Link>
          </Button>
        )}
        {creating || redirecting ? <Spinner label="در حال آماده‌سازی پرداخت" /> : null}
      </div>
    </div>
  );
}
