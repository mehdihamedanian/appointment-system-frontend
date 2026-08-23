"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ApiErrorState, SessionExpiredState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { useSession } from "@/features/auth/session-provider";
import { verifyPayment } from "@/lib/api/payment";
import {
  isNetworkUncertaintyError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { invalidateAfterBookingResult } from "@/lib/booking/confirmation-cache";
import { clearHoldReference } from "@/lib/booking/hold-session";
import { markBookingDraftCompleted } from "@/lib/booking/persistence";
import { paymentReferenceFromSearch } from "@/lib/payment/adapter";
import { derivePaymentUiState } from "@/lib/payment/state";
import {
  PAYMENT_BROADCAST_CHANNEL,
  clearPaymentReference,
  publishPaymentStatus,
  readPaymentReference,
} from "@/lib/payment/session-store";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import { routes, LOGIN_PATH } from "@/constants/routes";

export function PaymentResultScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fromQuery = paymentReferenceFromSearch(searchParams);
  const stored = typeof window === "undefined" ? undefined : readPaymentReference();
  const reference = fromQuery ?? stored?.paymentReference ?? "";

  const query = useQuery({
    queryKey: queryKeys.booking.payment(reference),
    queryFn: ({ signal }) => verifyPayment(reference, signal),
    enabled: isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const result = query.data;
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const uiState = derivePaymentUiState({
    verifying: !result && (query.isPending || query.isFetching),
    resultStatus: result?.alreadyPaid ? "paid" : result?.status,
    offline: error ? isNetworkUncertaintyError(error) : false,
    error: Boolean(error) && !(error && isNetworkUncertaintyError(error)),
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, [uiState]);

  useEffect(() => {
    if (!result) {
      return;
    }
    publishPaymentStatus(result.publicReference ?? result.paymentId, result.status);
    if (result.status === "paid" || result.status === "deposit_paid" || result.status === "pay_at_location") {
      if (result.bookingReference) {
        markBookingDraftCompleted(result.bookingReference);
        clearHoldReference();
        clearPaymentReference();
        invalidateAfterBookingResult(queryClient, user?.id);
      }
    }
  }, [queryClient, result, user?.id]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !reference) {
      return;
    }
    const channel = new BroadcastChannel(PAYMENT_BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ reference?: string }>) => {
      if (event.data?.reference === reference) {
        void query.refetch();
      }
    };
    return () => channel.close();
  }, [query, reference]);

  if (!reference) {
    return (
      <div className="booking-payment-result">
        <Alert
          tone="warning"
          title="مرجع پرداخت معتبر نیست"
          description="وضعیت پرداخت از نشانی صفحه خوانده نشد. پارامترهای درگاه به‌عنوان نتیجه پرداخت پذیرفته نمی‌شوند."
        />
        <Button onClick={() => router.push(routes.customer.bookingPayment)}>بازگشت به پرداخت</Button>
      </div>
    );
  }

  if (error && isSessionExpiredError(error)) {
    return (
      <SessionExpiredState
        description="نشست شما پایان یافته است. پس از ورود دوباره، وضعیت پرداخت از همین پیوند قابل بررسی است."
        action={
          <Button asChild>
            <Link href={LOGIN_PATH}>ورود</Link>
          </Button>
        }
      />
    );
  }

  if (query.isPending && !result) {
    return (
      <div className="booking-payment-result" aria-busy="true" aria-label="در حال بررسی پرداخت">
        <Skeleton variant="card" />
      </div>
    );
  }

  if (uiState === "unknown" || (error && isNetworkUncertaintyError(error))) {
    return (
      <div className="booking-payment-result">
        <h1 ref={headingRef} tabIndex={-1} className="text-page-title">
          وضعیت پرداخت نامشخص است
        </h1>
        <ApiErrorState
          title="نتیجه پرداخت هنوز تأیید نشده"
          description="پرداخت ناموفق فرض نشد. تا دریافت پاسخ سرویس، پرداخت جدیدی ساخته نمی‌شود."
          onRetry={() => void query.refetch()}
          requestId={error?.requestId}
        />
      </div>
    );
  }

  if (uiState === "error" || !result) {
    return (
      <div className="booking-payment-result">
        <ApiErrorState
          title="بررسی پرداخت ممکن نشد"
          description="لطفاً بدون ایجاد تراکنش جدید دوباره وضعیت را بگیرید."
          onRetry={() => void query.refetch()}
          requestId={error?.requestId}
        />
      </div>
    );
  }

  const paidAt = result.paidAt ? formatAppointmentParts(result.paidAt)?.label : undefined;
  const title =
    uiState === "success"
      ? result.status === "pay_at_location"
        ? "رزرو با پرداخت در محل ثبت شد"
        : "پرداخت با موفقیت تأیید شد"
      : uiState === "failed"
        ? "پرداخت ناموفق بود"
        : uiState === "pending"
          ? "در حال بررسی پرداخت"
          : uiState === "cancelled"
            ? "پرداخت لغو شد"
            : uiState === "expired"
              ? "مهلت پرداخت به پایان رسید"
              : "وضعیت پرداخت";

  return (
    <div className={`booking-payment-result booking-payment-result--${uiState}`}>
      <h1 ref={headingRef} tabIndex={-1} className="text-page-title">
        {title}
      </h1>
      {uiState === "pending" ? (
        <Alert tone="info" title="در حال بررسی پرداخت" description="تا مشخص شدن نتیجه، پرداخت دیگری ایجاد نمی‌شود." />
      ) : null}
      {uiState === "failed" ? (
        <Alert tone="error" title="پرداخت تأیید نشد" description="در صورت مجاز بودن سرویس، می‌توانید پس از بررسی وضعیت دوباره تلاش کنید." />
      ) : null}
      <section className="slot-hold-card">
        <dl className="booking-summary-list">
          {result.payableNowLabel ? (
            <div>
              <dt>مبلغ پرداخت‌شده</dt>
              <dd>
                <strong className="ltr-value booking-money">{result.payableNowLabel}</strong>
              </dd>
            </div>
          ) : null}
          {result.transactionReference ? (
            <div>
              <dt>کد تراکنش</dt>
              <dd>
                <span className="ltr-value">{result.transactionReference}</span>
              </dd>
            </div>
          ) : null}
          {result.bookingReference ? (
            <div>
              <dt>کد پیگیری نوبت</dt>
              <dd>
                <span className="ltr-value">{result.bookingReference}</span>
              </dd>
            </div>
          ) : null}
          {paidAt ? (
            <div>
              <dt>زمان تراکنش</dt>
              <dd>{paidAt}</dd>
            </div>
          ) : null}
          <div>
            <dt>وضعیت</dt>
            <dd>
              <StatusBadge status={result.status === "paid" ? "paid" : result.status === "failed" ? "failed" : "pendingPayment"} />
            </dd>
          </div>
        </dl>
      </section>
      <div className="booking-payment-result__actions">
        {uiState === "success" && result.bookingReference ? (
          <Button asChild>
            <Link href={routes.customer.bookingConfirmation(result.bookingReference)}>مشاهده تأیید رزرو</Link>
          </Button>
        ) : null}
        <Button asChild variant={uiState === "success" ? "secondary" : "primary"}>
          <Link href={routes.customer.dashboard}>داشبورد</Link>
        </Button>
        {uiState === "pending" ? (
          <Button variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}>
            بررسی دوباره وضعیت
          </Button>
        ) : null}
        {(uiState === "failed" || uiState === "expired" || uiState === "cancelled") && result.retryAllowed !== false ? (
          <Button variant="secondary" onClick={() => router.push(routes.customer.bookingPayment)}>
            تلاش دوباره
          </Button>
        ) : null}
      </div>
    </div>
  );
}
