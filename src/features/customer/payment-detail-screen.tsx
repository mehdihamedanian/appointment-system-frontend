"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { PaymentListSkeleton } from "@/features/customer/payment-list-skeleton";
import { PaymentReceiptAction } from "@/features/customer/payment-receipt-action";
import { useSession } from "@/features/auth/session-provider";
import { customerPaymentHistoryDetailQueryOptions } from "@/lib/api/customer-payments";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import { PAYMENT_PENDING_STATUSES } from "@/types/payment-history";
import { paymentsHref } from "@/lib/customer/payment-history-filters";
import { getStatusPresentation } from "@/lib/status/status-map";

export function PaymentDetailScreen() {
  const params = useParams<{ paymentReference?: string }>();
  const reference = typeof params.paymentReference === "string" ? params.paymentReference : "";
  const validReference = isSafePublicId(reference) ? reference : "";
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  const query = useQuery({
    ...customerPaymentHistoryDetailQueryOptions(user?.id ?? "anonymous", validReference),
    enabled: sessionReady && Boolean(validReference),
  });

  if (!validReference) {
    return (
      <div className="payments-page">
        <PageHeader title="جزئیات پرداخت" />
        <NoResultsState
          title="پرداخت پیدا نشد"
          description="شناسه پرداخت معتبر نیست."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.customer.payments}>بازگشت به پرداخت‌ها</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="payments-page">
        <PageHeader title="جزئیات پرداخت" description="جزئیات پرداخت پس از ورود نمایش داده می‌شود." />
        <PaymentListSkeleton />
      </div>
    );
  }

  const error = query.isError ? toAppApiError(query.error) : undefined;
  const payment = query.data;
  const canRefresh = payment ? PAYMENT_PENDING_STATUSES.includes(payment.status) : false;

  return (
    <div className="payments-page payment-detail">
      <PageHeader
        title="جزئیات پرداخت"
        description="اطلاعات این پرداخت فقط از سرویس خوانده می‌شود و وضعیت مالی در مرورگر تغییر نمی‌کند."
        breadcrumb={
          <nav aria-label="مسیر صفحه">
            <ol className="ds-breadcrumb">
              <li>
                <Link href={paymentsHref()}>پرداخت‌ها</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <span aria-current="page">جزئیات</span>
              </li>
            </ol>
          </nav>
        }
        secondaryActions={
          canRefresh ? (
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
              loading={query.isFetching && !query.isPending}
              onClick={() => {
                void query.refetch();
              }}
            >
              به‌روزرسانی وضعیت
            </Button>
          ) : undefined
        }
      />

      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری جزئیات پرداخت." : ""}
        {query.isError ? "بارگذاری جزئیات پرداخت با خطا روبه‌رو شد." : ""}
        {payment ? `وضعیت پرداخت: ${getStatusPresentation(payment.status).label}` : ""}
      </span>

      {query.isPending ? <PaymentListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="پرداخت در دسترس نیست"
            description="این پرداخت پیدا نشد یا دسترسی به آن ندارید."
          />
        ) : (
          <ApiErrorState
            title="جزئیات پرداخت بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && payment ? (
        <section className="payment-detail__card" aria-labelledby="payment-detail-amount">
          <div className="payment-card__status">
            <StatusBadge status={payment.status} />
            {payment.refundStatus ? <StatusBadge status={payment.refundStatus} /> : null}
          </div>
          <h2 id="payment-detail-amount" className="payment-card__amount">
            {payment.amountLabel}
          </h2>
          {payment.timestampLabel ? (
            <p>
              <time dateTime={payment.paidAt ?? payment.createdAt}>{payment.timestampLabel}</time>
            </p>
          ) : null}
          {payment.statusHint ? <p className="text-caption">{payment.statusHint}</p> : null}

          <dl className="payment-detail__meta">
            <div>
              <dt>کد پرداخت</dt>
              <dd>
                <ReferenceCopy value={payment.publicReference} label="رونوشت کد پرداخت" />
              </dd>
            </div>
            {payment.transactionReference ? (
              <div>
                <dt>کد تراکنش</dt>
                <dd>
                  <ReferenceCopy value={payment.transactionReference} label="رونوشت کد تراکنش" />
                </dd>
              </div>
            ) : null}
            {payment.bookingReference ? (
              <div>
                <dt>کد رزرو</dt>
                <dd>
                  <span className="ltr-value">{payment.bookingReference}</span>
                </dd>
              </div>
            ) : null}
            {payment.methodLabel ? (
              <div>
                <dt>روش پرداخت</dt>
                <dd>{payment.methodLabel}</dd>
              </div>
            ) : null}
            {payment.classificationLabel ? (
              <div>
                <dt>نوع پرداخت</dt>
                <dd>{payment.classificationLabel}</dd>
              </div>
            ) : null}
            {payment.gatewayName ? (
              <div>
                <dt>درگاه</dt>
                <dd>{payment.gatewayName}</dd>
              </div>
            ) : null}
            {payment.serviceName ? (
              <div>
                <dt>سرویس</dt>
                <dd>{payment.serviceName}</dd>
              </div>
            ) : null}
            {payment.appointmentWhenLabel ? (
              <div>
                <dt>زمان نوبت</dt>
                <dd>{payment.appointmentWhenLabel}</dd>
              </div>
            ) : null}
            {payment.refundAmountLabel ? (
              <div>
                <dt>مبلغ بازپرداخت</dt>
                <dd>{payment.refundAmountLabel}</dd>
              </div>
            ) : null}
            {payment.refundReference ? (
              <div>
                <dt>کد بازپرداخت</dt>
                <dd>
                  <span className="ltr-value">{payment.refundReference}</span>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="payment-card__actions">
            {payment.appointmentAvailable && payment.appointmentId ? (
              <Button asChild>
                <Link href={routes.customer.appointmentDetail(payment.appointmentId)}>
                  مشاهده نوبت مرتبط
                </Link>
              </Button>
            ) : null}
            {payment.appointmentId && !payment.appointmentAvailable ? (
              <p className="text-caption">نوبت مرتبط در دسترس نیست.</p>
            ) : null}
            <PaymentReceiptAction
              paymentReference={payment.publicReference}
              receiptUrl={payment.receiptUrl}
              receiptAvailable={payment.receiptAvailable}
            />
            <Button asChild variant="secondary">
              <Link href={paymentsHref()}>بازگشت به فهرست</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
