"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Spinner } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ApiErrorState, SessionExpiredState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { HoldCountdown } from "@/features/booking/hold-countdown";
import { useSession } from "@/features/auth/session-provider";
import { slotHoldQueryOptions } from "@/lib/api/hold";
import {
  isForbiddenError,
  isNetworkUncertaintyError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { invalidateAfterBookingResult } from "@/lib/booking/confirmation-cache";
import {
  bookingHoldReturnHref,
  invalidateAfterHoldExpiry,
  persistHoldTerminalDraft,
} from "@/lib/booking/hold-expiry";
import {
  HOLD_BROADCAST_CHANNEL,
  clearHoldReference,
  publishHoldStatus,
  writeHoldReference,
} from "@/lib/booking/hold-session";
import {
  deriveHoldUiState,
  holdAnnouncement,
  paymentAllowed,
} from "@/lib/booking/hold-state";
import { markBookingDraftCompleted } from "@/lib/booking/persistence";
import { remainingMsFromTimestamps } from "@/lib/date-time/server-clock";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { isSafePublicId } from "@/lib/public/booking-href";
import { HOLD_REVALIDATE_NEAR_MS, type HoldUiState } from "@/types/hold";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { AppApiError } from "@/types/api";

const HOLD_COPY =
  "این زمان به‌صورت موقت برای شما نگه داشته شده و پس از تکمیل موفق پرداخت قطعی می‌شود.";

function isPaymentPending(status?: string): boolean {
  const raw = status?.toLowerCase() ?? "";
  return raw.includes("pending") || raw.includes("processing") || raw.includes("verif");
}

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SlotHoldScreen({ reference }: { reference: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const expiredRef = useRef<HTMLDivElement>(null);
  const paymentLock = useRef(false);
  const revalidatedNearZero = useRef(false);
  const terminalPersisted = useRef(false);
  const lastRefetchAt = useRef(0);
  const [now, setNow] = useState(0);
  const [paymentInFlight, setPaymentInFlight] = useState(false);
  const [actionError, setActionError] = useState<AppApiError>();

  const safeReference = isSafePublicId(reference) ? reference : "";
  const holdQuery = useQuery(slotHoldQueryOptions(safeReference));
  const refetchHold = holdQuery.refetch;
  const hold = holdQuery.data;
  const receivedAt = holdQuery.dataUpdatedAt || now;
  const remainingMs = hold
    ? remainingMsFromTimestamps({
        expiresAt: hold.expiresAt,
        serverNow: hold.serverNow,
        receivedAt,
        now: now || receivedAt,
      })
    : null;

  const queryError = holdQuery.isError ? toAppApiError(holdQuery.error) : undefined;
  const sessionExpired = queryError ? isSessionExpiredError(queryError) : false;
  const invalidFromApi = queryError
    ? isNotFoundError(queryError) || isForbiddenError(queryError)
    : false;
  const invalidHold = !safeReference || invalidFromApi;
  const offline =
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    (queryError ? isNetworkUncertaintyError(queryError) : false);
  const nearZero = remainingMs !== null && remainingMs <= HOLD_REVALIDATE_NEAR_MS;
  const checkingStatus =
    holdQuery.isFetching && nearZero
      ? true
      : Boolean(hold?.status === "active" && remainingMs !== null && remainingMs <= 0);

  const uiState: HoldUiState = deriveHoldUiState({
    hold: invalidHold && !hold ? { holdId: "invalid", status: "invalid", slot: { id: "" } } : hold,
    loading: holdQuery.isPending,
    remainingMs,
    paymentInFlight,
    checkingStatus,
    offline: offline && !hold,
    error: Boolean(queryError) && !invalidHold && !offline,
  });
  const announcement = holdAnnouncement(uiState) ?? "";
  const canPay = paymentAllowed(uiState) && !paymentInFlight && !checkingStatus;
  const slotLabel = hold?.slot.startsAt
    ? formatAppointmentParts(hold.slot.startsAt, hold.timezone)?.label
    : undefined;

  useEffect(() => {
    if (!hold?.expiresAt || hold.status !== "active") {
      return;
    }
    const tick = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      const nextRemaining = remainingMsFromTimestamps({
        expiresAt: hold.expiresAt,
        serverNow: hold.serverNow,
        receivedAt,
        now: nextNow,
      });
      if (nextRemaining !== null && nextRemaining <= HOLD_REVALIDATE_NEAR_MS && !revalidatedNearZero.current) {
        revalidatedNearZero.current = true;
        void refetchHold();
      }
    };
    const timer = window.setInterval(tick, 1000);
    const immediate = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(immediate);
    };
  }, [hold?.expiresAt, hold?.serverNow, hold?.status, receivedAt, refetchHold]);

  useEffect(() => {
    const refetchIfFresh = () => {
      const stamp = Date.now();
      if (stamp - lastRefetchAt.current < 1500) {
        return;
      }
      lastRefetchAt.current = stamp;
      setNow(stamp);
      if (document.visibilityState === "visible") {
        void refetchHold();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refetchIfFresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("online", refetchIfFresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("online", refetchIfFresh);
    };
  }, [refetchHold]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !safeReference) {
      return;
    }
    const channel = new BroadcastChannel(HOLD_BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ reference?: string; status?: string }>) => {
      if (event.data?.reference !== safeReference) {
        return;
      }
      void refetchHold();
    };
    return () => channel.close();
  }, [refetchHold, safeReference]);

  useEffect(() => {
    if (!hold?.publicReference && !hold?.holdId) {
      return;
    }
    writeHoldReference(hold.publicReference ?? hold.holdId);
    publishHoldStatus({
      reference: hold.publicReference ?? hold.holdId,
      status: hold.status,
    });
  }, [hold?.holdId, hold?.publicReference, hold?.status]);

  useEffect(() => {
    if (uiState === "expired" || uiState === "released" || uiState === "invalid") {
      expiredRef.current?.focus();
    }
  }, [uiState]);

  useEffect(() => {
    if (uiState !== "expired" && uiState !== "released" && uiState !== "invalid") {
      return;
    }
    if (paymentInFlight || terminalPersisted.current) {
      return;
    }
    terminalPersisted.current = true;
    const notice =
      uiState === "invalid" ? "hold_invalid" : uiState === "released" ? "hold_released" : "hold_expired";
    persistHoldTerminalDraft(notice);
    invalidateAfterHoldExpiry(queryClient);
  }, [paymentInFlight, queryClient, uiState]);

  useEffect(() => {
    if (uiState !== "consumed" || !hold?.bookingReference) {
      return;
    }
    clearHoldReference();
    markBookingDraftCompleted(hold.bookingReference);
    invalidateAfterBookingResult(queryClient, user?.id);
    router.replace(routes.customer.bookingConfirmation(hold.bookingReference));
  }, [hold?.bookingReference, queryClient, router, uiState, user?.id]);

  async function onContinuePayment() {
    if (!canPay || !hold || paymentLock.current) {
      return;
    }
    paymentLock.current = true;
    setPaymentInFlight(true);
    setActionError(undefined);
    try {
      const latest = await refetchHold();
      const current = latest.data;
      if (!current || current.status !== "active") {
        return;
      }
      const remaining = remainingMsFromTimestamps({
        expiresAt: current.expiresAt,
        serverNow: current.serverNow,
        receivedAt: latest.dataUpdatedAt || Date.now(),
        now: Date.now(),
      });
      if (remaining !== null && remaining <= 0) {
        return;
      }
      writeHoldReference(current.publicReference ?? current.holdId);
      router.push(routes.customer.bookingPayment);
    } catch (error) {
      setActionError(toAppApiError(error));
    } finally {
      paymentLock.current = false;
      setPaymentInFlight(false);
    }
  }

  function onSelectNewTime() {
    const draft = persistHoldTerminalDraft(
      uiState === "invalid" ? "hold_invalid" : uiState === "released" ? "hold_released" : "hold_expired",
    );
    invalidateAfterHoldExpiry(queryClient);
    router.push(draft ? bookingHoldReturnHref(draft, "time") : `${routes.customer.booking}?step=time`);
  }

  if (sessionExpired) {
    return (
      <SessionExpiredState
        description="نشست شما پایان یافته است. پس از ورود دوباره، وضعیت رزرو موقت از همین پیوند قابل بررسی است."
        action={
          <Button asChild>
            <Link href={LOGIN_PATH}>ورود</Link>
          </Button>
        }
      />
    );
  }

  if (uiState === "loading-existing-hold") {
    return (
      <div className="slot-hold" role="status" aria-busy="true" aria-label="در حال بررسی رزرو موقت">
        <Skeleton variant="card" />
        <Skeleton variant="line" />
      </div>
    );
  }

  if (uiState === "offline") {
    return (
      <div className="slot-hold">
        <PageHeader title="رزرو موقت" description="پرداخت تا بررسی وضعیت غیرفعال است." />
        <ApiErrorState
          title="ارتباط برقرار نشد"
          description="وضعیت رزرو موقت مشخص نیست. فعال بودن یا انقضا فرض نشد."
          onRetry={() => void refetchHold()}
          requestId={queryError?.requestId}
        />
      </div>
    );
  }

  if (uiState === "error") {
    return (
      <div className="slot-hold">
        <PageHeader title="رزرو موقت" description="پرداخت تا بررسی وضعیت غیرفعال است." />
        <ApiErrorState
          title="وضعیت رزرو موقت نامشخص است"
          description="فعال بودن یا انقضا فرض نشد. لطفاً دوباره وضعیت را از سرویس بگیرید."
          onRetry={() => void refetchHold()}
          requestId={queryError?.requestId}
        />
      </div>
    );
  }

  const warning =
    uiState === "warning"
      ? "کمتر از دو دقیقه تا پایان نگه‌داشتن موقت باقی مانده است."
      : uiState === "critical"
        ? "کمتر از سی ثانیه تا پایان نگه‌داشتن موقت باقی مانده است."
        : undefined;
  const pendingPayment = isPaymentPending(hold?.paymentStatus);

  return (
    <div className={`slot-hold slot-hold--${uiState}`}>
      <PageHeader title="رزرو موقت" description={HOLD_COPY} />
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
      {uiState === "expired" ? (
        <div ref={expiredRef} tabIndex={-1}>
          <Alert
            tone="error"
            title="مهلت نگه‌داشتن این زمان به پایان رسید"
            description="پرداخت با این رزرو موقت ممکن نیست. زمان قبلی انتخاب‌شده نیست و نوبت جدیدی به‌صورت خودکار انتخاب نشد."
          />
        </div>
      ) : null}
      {uiState === "released" ? (
        <div ref={expiredRef} tabIndex={-1}>
          <Alert tone="warning" title="رزرو موقت آزاد شد" description="می‌توانید زمان دیگری انتخاب کنید." />
        </div>
      ) : null}
      {uiState === "invalid" ? (
        <div ref={expiredRef} tabIndex={-1}>
          <Alert
            tone="error"
            title="رزرو موقت معتبر نیست"
            description="این نگه‌داری زمان قابل استفاده نیست. می‌توانید زمان دیگری انتخاب کنید."
          />
        </div>
      ) : null}
      {uiState === "consumed" ? (
        <Alert
          tone="info"
          title={pendingPayment ? "وضعیت پرداخت در حال بررسی است" : "رزرو موقت استفاده شد"}
          description={
            pendingPayment
              ? "نتیجه پرداخت هنوز از سرویس نوبت‌دهی نرسیده است. زمان دیگری انتخاب نشد."
              : "در حال بررسی نتیجه رزرو."
          }
        />
      ) : null}
      {uiState === "checking-status" ? (
        <Alert
          tone="info"
          title="در حال بررسی وضعیت رزرو موقت"
          description="پایان شمارنده به‌معنای انقضای قطعی نیست تا سرویس نوبت‌دهی وضعیت را اعلام کند."
        />
      ) : null}
      {uiState === "starting-payment" || uiState === "payment-processing" ? (
        <Alert tone="info" title="در حال آماده‌سازی پرداخت" description="لطفاً این صفحه را نبندید." />
      ) : null}
      {uiState === "active" || uiState === "warning" || uiState === "critical" ? (
        <Alert
          tone={uiState === "active" ? "info" : "warning"}
          title="رزرو موقت"
          description={warning ? `${HOLD_COPY} ${warning}` : HOLD_COPY}
        />
      ) : null}
      {actionError ? (
        <Alert
          tone="error"
          title="پرداخت شروع نشد"
          description={
            actionError.requestId
              ? `${actionError.message} شناسه درخواست: ${actionError.requestId}`
              : actionError.message
          }
        />
      ) : null}

      <section className="slot-hold-card" aria-labelledby="slot-hold-summary">
        <div className="slot-hold-card__header">
          <h2 id="slot-hold-summary" className="text-card-title">
            خلاصه پرداخت
          </h2>
          {hold?.expiresAt && (uiState === "active" || uiState === "warning" || uiState === "critical") ? (
            <HoldCountdown remainingMs={remainingMs} state={uiState} />
          ) : null}
        </div>
        <dl className="booking-summary-list">
          {hold?.serviceName ? <SummaryRow term="خدمت">{hold.serviceName}</SummaryRow> : null}
          {slotLabel ? <SummaryRow term="زمان">{slotLabel}</SummaryRow> : null}
          {hold?.providerLabel ? <SummaryRow term="متخصص">{hold.providerLabel}</SummaryRow> : null}
          {hold?.branchName ? <SummaryRow term="شعبه">{hold.branchName}</SummaryRow> : null}
          {hold?.payableNowLabel ? (
            <SummaryRow term="قابل پرداخت اکنون">
              <strong className="ltr-value booking-money">{hold.payableNowLabel}</strong>
            </SummaryRow>
          ) : null}
        </dl>
      </section>

      <div className="slot-hold-actions">
        {uiState === "checking-status" || uiState === "consumed" || uiState === "starting-payment" || uiState === "payment-processing" ? (
          <Button onClick={() => void refetchHold()} loading={holdQuery.isFetching}>
            بررسی دوباره وضعیت
          </Button>
        ) : null}
        {uiState === "expired" || uiState === "released" || uiState === "invalid" ? (
          <>
            <Button onClick={onSelectNewTime}>انتخاب زمان جدید</Button>
            <Button variant="secondary" onClick={() => router.push(routes.customer.booking)}>
              بازگشت به خدمت و شعبه
            </Button>
          </>
        ) : (
          <Button
            onClick={() => void onContinuePayment()}
            loading={paymentInFlight || uiState === "starting-payment"}
            disabled={!canPay}
          >
            ادامه پرداخت
          </Button>
        )}
      </div>
      {paymentInFlight || uiState === "checking-status" ? (
        <p className="text-caption">
          <Spinner label={paymentInFlight ? "در حال آماده‌سازی پرداخت" : "در حال بررسی وضعیت"} />
        </p>
      ) : null}
    </div>
  );
}
