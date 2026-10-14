"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Spinner } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ApiErrorState, EmptyState, SessionExpiredState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { CouponField } from "@/features/booking/coupon-field";
import { HoldCountdown } from "@/features/booking/hold-countdown";
import { PaymentMethodList } from "@/features/booking/payment-methods";
import { PaymentPricingSummary } from "@/features/booking/payment-pricing";
import Link from "next/link";
import { createPaymentSession, paymentNavigation } from "@/lib/api/payment";
import { fetchBookingQuote } from "@/lib/api/booking";
import { fetchPublicBusiness } from "@/lib/api/public";
import { slotHoldQueryOptions } from "@/lib/api/hold";
import {
  isNetworkUncertaintyError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { isSlotTakenError } from "@/lib/availability/slot-taken";
import { quoteIntentFingerprint } from "@/lib/booking/idempotency";
import { isQuoteChangedError, isQuoteExpired, isQuoteExpiredError } from "@/lib/booking/quote";
import {
  bookingHoldReturnHref,
  invalidateAfterHoldExpiry,
  persistHoldTerminalDraft,
} from "@/lib/booking/hold-expiry";
import { deriveHoldUiState, holdUrgency, paymentAllowed } from "@/lib/booking/hold-state";
import { remainingMsFromTimestamps } from "@/lib/date-time/server-clock";
import { couponErrorMessage, isAlreadyPaidError, isAlreadyProcessingError, isCouponError } from "@/lib/payment/errors";
import { paymentIdempotencyKey, paymentIntentFingerprint } from "@/lib/payment/idempotency";
import { getSafeGatewayRedirect } from "@/lib/payment/safe-gateway-url";
import { writePaymentReference } from "@/lib/payment/session-store";
import { derivePaymentUiState, paymentAttemptBlocked } from "@/lib/payment/state";
import { requiresHoldForMethod } from "@/lib/payment/adapter";
import { useIsClient } from "@/lib/accessibility/focus";
import { draftFromPersisted, readBookingDraft } from "@/lib/booking/persistence";
import { readHoldReference } from "@/lib/booking/hold-session";
import { HOLD_REVALIDATE_NEAR_MS } from "@/types/hold";
import { emptyBookingDraft } from "@/types/booking";
import type { PaymentMethodType } from "@/types/payment";
import { queryKeys } from "@/lib/query/keys";
import { isAdminCouponsEnabled } from "@/lib/admin/coupon-context";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { AppApiError } from "@/types/api";

export function PaymentScreen() {
  const isClient = useIsClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const revalidatedNearZero = useRef(false);
  const lastRefetchAt = useRef(0);
  const persisted = typeof window === "undefined" ? null : readBookingDraft();
  const draft = persisted ? draftFromPersisted(persisted) : emptyBookingDraft();
  const holdReference = typeof window === "undefined" ? undefined : readHoldReference();

  const [now, setNow] = useState(0);
  const [method, setMethod] = useState<PaymentMethodType>();
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string>();
  const [couponError, setCouponError] = useState<string>();
  const [couponSuccess, setCouponSuccess] = useState<string>();
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [creating, setCreating] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<AppApiError>();
  const [priceAnnouncement, setPriceAnnouncement] = useState("");

  const holdQuery = useQuery({
    ...slotHoldQueryOptions(holdReference ?? ""),
    enabled: Boolean(holdReference),
  });
  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const couponsFeatureEnabled = isAdminCouponsEnabled(businessQuery.data);
  const activeCouponCode = couponsFeatureEnabled ? couponCode : undefined;
  const quoteFingerprint = `${quoteIntentFingerprint(draft, draft.quoteId)}:${activeCouponCode ?? ""}`;
  const quoteQuery = useQuery({
    queryKey: queryKeys.booking.quote(quoteFingerprint),
    queryFn: ({ signal }) => fetchBookingQuote(draft, signal, activeCouponCode),
    enabled: Boolean(draft.serviceId && draft.slotId && draft.date),
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const quote = quoteQuery.data;
  const options = quote?.paymentOptions ?? [];
  const selectedType = method ?? (options.length === 1 ? options[0]?.type : undefined);
  const selectedOption = options.find((item) => item.type === selectedType);
  const needsHold = selectedType ? requiresHoldForMethod(selectedType) : options.some((item) => requiresHoldForMethod(item.type));
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
  const holdUi = deriveHoldUiState({
    hold,
    loading: holdQuery.isPending && needsHold,
    remainingMs,
  });
  const holdActive = needsHold ? paymentAllowed(holdUi) : true;
  const uiState = derivePaymentUiState({
    applyingCoupon,
    creating,
    redirecting,
    offline: quoteQuery.isError && isNetworkUncertaintyError(toAppApiError(quoteQuery.error)),
    error: quoteQuery.isError && !isNetworkUncertaintyError(toAppApiError(quoteQuery.error)),
  });
  const blocked = paymentAttemptBlocked(uiState) || !holdActive;
  const quoteError = quoteQuery.isError ? toAppApiError(quoteQuery.error) : undefined;

  useEffect(() => {
    if (!hold?.expiresAt || hold.status !== "active" || !needsHold) {
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
        void holdQuery.refetch();
      }
    };
    const timer = window.setInterval(tick, 1000);
    const immediate = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(immediate);
    };
  }, [hold?.expiresAt, hold?.serverNow, hold?.status, holdQuery, needsHold, receivedAt]);

  useEffect(() => {
    const refetchIfFresh = () => {
      const stamp = Date.now();
      if (stamp - lastRefetchAt.current < 1500) {
        return;
      }
      lastRefetchAt.current = stamp;
      setNow(stamp);
      if (document.visibilityState === "visible") {
        void quoteQuery.refetch();
        if (needsHold) {
          void holdQuery.refetch();
        }
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
  }, [holdQuery, needsHold, quoteQuery]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || applyingCoupon) {
      return;
    }
    setApplyingCoupon(true);
    setCouponError(undefined);
    setCouponSuccess(undefined);
    try {
      const next = await fetchBookingQuote(draft, undefined, code);
      if (next.coupon && next.coupon.status !== "applied") {
        setCouponError(next.coupon.message ?? "کد تخفیف اعمال نشد.");
        return;
      }
      if (!next.coupon) {
        setCouponError("سرویس نتیجه کد تخفیف را اعلام نکرد.");
        return;
      }
      setCouponCode(code);
      queryClient.setQueryData(queryKeys.booking.quote(`${quoteIntentFingerprint(draft, draft.quoteId)}:${code}`), next);
      setCouponSuccess("مبلغ‌ها با کد تخفیف به‌روزرسانی شد.");
      setPriceAnnouncement("مبلغ قابل پرداخت به‌روزرسانی شد.");
    } catch (error) {
      const normalized = toAppApiError(error);
      setCouponError(isCouponError(normalized) ? couponErrorMessage(normalized) : normalized.message);
    } finally {
      setApplyingCoupon(false);
    }
  }

  async function removeCoupon() {
    setCouponCode(undefined);
    setCouponInput("");
    setCouponError(undefined);
    setCouponSuccess(undefined);
    setPriceAnnouncement("کد تخفیف حذف شد و مبلغ از استعلام جدید خوانده می‌شود.");
    await quoteQuery.refetch();
  }

  async function onPay() {
    if (!selectedType || blocked || submitLock.current || !quote?.authoritative) {
      return;
    }
    submitLock.current = true;
    if (quote && isQuoteExpired(quote, quoteQuery.dataUpdatedAt || Date.now())) {
      submitLock.current = false;
      setActionError({ status: 410, message: "اعتبار استعلام به پایان رسید. لطفاً دوباره بررسی کنید." });
      return;
    }
    if (needsHold) {
      const latestHold = await holdQuery.refetch();
      if (!latestHold.data || latestHold.data.status !== "active") {
        persistHoldTerminalDraft("hold_expired");
        invalidateAfterHoldExpiry(queryClient);
        submitLock.current = false;
        return;
      }
    }
    setCreating(true);
    setActionError(undefined);
    const fingerprint = paymentIntentFingerprint({
      holdReference,
      quoteId: quote.id,
      method: selectedType,
      couponCode,
    });
    try {
      const result = await createPaymentSession(
        {
          method: selectedType,
          holdReference: needsHold ? holdReference : undefined,
          quoteId: quote.id,
          couponCode,
        },
        paymentIdempotencyKey(idempotencyRef, fingerprint),
      );
      if (result.outcome === "missing_endpoint") {
        setActionError({
          status: 404,
          message: "درگاه پرداخت هنوز به سرویس متصل نشده است. پرداخت ساخته نشد.",
        });
        return;
      }
      const session = result.session;
      if (session.alreadyPaid && session.bookingReference) {
        writePaymentReference({ paymentReference: session.publicReference ?? session.paymentId, holdReference });
        router.replace(routes.customer.bookingConfirmation(session.bookingReference));
        return;
      }
      if (session.alreadyProcessing || session.status === "processing" || session.status === "pending") {
        writePaymentReference({ paymentReference: session.publicReference ?? session.paymentId, holdReference });
        router.replace(`${routes.customer.bookingPaymentResult}?ref=${session.publicReference ?? session.paymentId}`);
        return;
      }
      if (selectedType === "pay_at_location" || session.status === "pay_at_location" || session.status === "paid") {
        writePaymentReference({ paymentReference: session.publicReference ?? session.paymentId, holdReference });
        router.replace(
          session.bookingReference
            ? routes.customer.bookingConfirmation(session.bookingReference)
            : `${routes.customer.bookingPaymentResult}?ref=${session.publicReference ?? session.paymentId}`,
        );
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
      writePaymentReference({
        paymentReference: session.publicReference ?? session.paymentId,
        holdReference,
      });
      setRedirecting(true);
      paymentNavigation.assign(redirectUrl);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isSessionExpiredError(normalized)) {
        setActionError(normalized);
        return;
      }
      if (isSlotTakenError(normalized)) {
        persistHoldTerminalDraft("hold_expired");
        invalidateAfterHoldExpiry(queryClient);
        router.push(bookingHoldReturnHref(draft, "time"));
        return;
      }
      if (isQuoteChangedError(normalized) || isQuoteExpiredError(normalized)) {
        setActionError({
          status: normalized.status,
          message: "مبلغ یا شرایط رزرو به‌روزرسانی شد. لطفاً دوباره بررسی کنید.",
        });
        await quoteQuery.refetch();
        return;
      }
      if (isAlreadyPaidError(normalized) || isAlreadyProcessingError(normalized)) {
        router.replace(routes.customer.bookingPaymentResult);
        return;
      }
      setActionError(normalized);
    } finally {
      submitLock.current = false;
      setCreating(false);
    }
  }

  if (quoteError && isSessionExpiredError(quoteError)) {
    return (
      <SessionExpiredState
        description="نشست شما پایان یافته است. پس از ورود دوباره، پرداخت از همین مسیر قابل ادامه است."
        action={
          <Button asChild>
            <Link href={LOGIN_PATH}>ورود</Link>
          </Button>
        }
      />
    );
  }

  if (isClient && (!draft.serviceId || !draft.slotId || !draft.date)) {
    return (
      <div className="booking-payment">
        <EmptyState
          title="رزرو در حال انجامی پیدا نشد"
          description="برای پرداخت نوبتی که قبلاً ثبت شده، از صفحه جزئیات همان نوبت اقدام کنید."
          action={
            <Button asChild>
              <Link href={routes.customer.appointments}>نوبت‌های من</Link>
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" asChild>
              <Link href={routes.customer.booking}>رزرو نوبت جدید</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (quoteQuery.isPending && !quote) {
    return (
      <div className="booking-payment" role="status" aria-busy="true" aria-label="در حال بارگذاری پرداخت">
        <Skeleton variant="card" />
        <Skeleton variant="line" />
      </div>
    );
  }

  if (!quote?.authoritative || options.length === 0) {
    return (
      <div className="booking-payment">
        <ApiErrorState
          title="روش پرداخت از سرویس دریافت نشد"
          description="مبلغ یا روش پرداخت در این صفحه محاسبه نمی‌شود. لطفاً دوباره تلاش کنید."
          onRetry={() => void quoteQuery.refetch()}
          requestId={quoteError?.requestId}
        />
      </div>
    );
  }

  const holdExpiredConfirmed = needsHold && (holdUi === "expired" || holdUi === "invalid" || holdUi === "released");
  const canSubmit =
    Boolean(selectedType) &&
    !blocked &&
    !holdExpiredConfirmed &&
    quote.authoritative &&
    !(needsHold && holdUrgency(remainingMs) === "elapsed" && hold?.status === "active");

  return (
    <div className={`booking-payment booking-payment--${uiState}`}>
      <PageHeader
        title="پرداخت"
        description="مبلغ و روش پرداخت فقط از استعلام سرویس نوبت‌دهی نمایش داده می‌شود."
      />
      <span className="visually-hidden" aria-live="polite">
        {priceAnnouncement}
        {uiState === "creating-payment" ? " در حال ایجاد درخواست پرداخت." : ""}
        {uiState === "redirecting" ? " در حال انتقال به درگاه پرداخت." : ""}
      </span>
      {needsHold && hold && remainingMs !== null && paymentAllowed(holdUi) ? (
        <Alert
          tone={holdUi === "active" ? "info" : "warning"}
          title="رزرو موقت"
          description="این زمان به‌صورت موقت نگه داشته شده و پس از پرداخت موفق قطعی می‌شود."
          action={<HoldCountdown remainingMs={remainingMs} state={holdUi} />}
        />
      ) : null}
      {holdExpiredConfirmed ? (
        <Alert
          tone="error"
          title="مهلت نگه‌داشتن این زمان به پایان رسید"
          description="پرداخت با این رزرو موقت ممکن نیست."
          action={
            <Button onClick={() => router.push(bookingHoldReturnHref(draft, "time"))}>انتخاب زمان جدید</Button>
          }
        />
      ) : null}
      {actionError ? (
        <Alert
          tone="error"
          title="پرداخت انجام نشد"
          description={
            actionError.requestId ? `${actionError.message} شناسه درخواست: ${actionError.requestId}` : actionError.message
          }
        />
      ) : null}
      {uiState === "redirecting" ? (
        <Alert tone="info" title="در حال انتقال به درگاه پرداخت" description="لطفاً این صفحه را نبندید." />
      ) : null}

      <div className="booking-payment__layout">
        <div className="booking-payment__main">
          <PaymentPricingSummary quote={quote} selected={selectedOption} />
          <PaymentMethodList
            options={options}
            selected={selectedType}
            onSelect={setMethod}
            disabled={blocked}
          />
          {couponsFeatureEnabled ? (
            <CouponField
              value={couponInput}
              onChange={setCouponInput}
              onApply={() => void applyCoupon()}
              onRemove={() => void removeCoupon()}
              applied={quote.coupon?.status === "applied" ? quote.coupon : undefined}
              loading={applyingCoupon}
              error={couponError}
              success={couponSuccess}
              disabled={blocked}
            />
          ) : null}
        </div>
        <aside className="booking-payment__aside" aria-label="خلاصه پرداخت">
          {selectedOption?.payableNowLabel ?? quote.payableNowLabel ? (
            <p>
              قابل پرداخت اکنون:{" "}
              <strong className="ltr-value booking-money">
                {selectedOption?.payableNowLabel ?? quote.payableNowLabel}
              </strong>
            </p>
          ) : null}
          {needsHold && hold && remainingMs !== null && paymentAllowed(holdUi) ? (
            <HoldCountdown remainingMs={remainingMs} state={holdUi} />
          ) : null}
        </aside>
      </div>

      <div className="booking-payment__actions">
        <Button
          onClick={() => void onPay()}
          loading={creating || redirecting}
          disabled={!canSubmit}
        >
          {selectedType === "pay_at_location" ? "ثبت با پرداخت در محل" : "پرداخت"}
        </Button>
        {creating || redirecting ? <Spinner label="در حال آماده‌سازی پرداخت" /> : null}
      </div>
    </div>
  );
}
