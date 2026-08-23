"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { OfferCountdown } from "@/features/customer/offer-countdown";
import { WaitingListSkeleton } from "@/features/customer/waiting-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  acceptWaitingListOffer,
  invalidateAfterWaitingListAccept,
  invalidateWaitingListCaches,
  rejectWaitingListOffer,
  waitingListOfferQueryOptions,
} from "@/lib/api/customer-waiting-list";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { writeHoldReference } from "@/lib/booking/hold-session";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import { TERMINAL_OFFER_STATUSES } from "@/types/waiting-list";

export function WaitingListOfferScreen({ reference: referenceProp }: { reference?: string } = {}) {
  const params = useParams<{ offerReference?: string }>();
  const reference =
    referenceProp ??
    (typeof params.offerReference === "string" ? params.offerReference : "");
  const valid = isSafePublicId(reference) ? reference : "";
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const acceptLock = useRef(false);
  const rejectLock = useRef(false);
  const acceptKey = useRef(createIdempotencyKey());
  const rejectKey = useRef(createIdempotencyKey());

  const query = useQuery({
    ...waitingListOfferQueryOptions(user?.id ?? "anonymous", valid),
    enabled: sessionReady && Boolean(valid),
  });
  const [fallbackReceivedAt] = useState(() => Date.now());
  const receivedAt = query.dataUpdatedAt || fallbackReceivedAt;

  const onExpired = useCallback(() => {
    void query.refetch();
  }, [query]);

  if (!valid) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="پیشنهاد زمان" />
        <NoResultsState title="پیشنهاد پیدا نشد" description="شناسه پیشنهاد معتبر نیست." />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="پیشنهاد زمان" />
        <WaitingListSkeleton count={2} />
      </div>
    );
  }

  const error = query.isError ? toAppApiError(query.error) : undefined;
  const offer = query.data;
  const terminal = offer ? TERMINAL_OFFER_STATUSES.includes(offer.status) : false;
  const canAct = Boolean(offer?.canAccept && !terminal && !accepting);

  async function onAccept() {
    if (acceptLock.current || !offer) return;
    acceptLock.current = true;
    setAccepting(true);
    let navigated = false;
    try {
      const outcome = await acceptWaitingListOffer(offer.publicReference, acceptKey.current);
      invalidateAfterWaitingListAccept(queryClient, user?.id, outcome);
      if (outcome.outcome === "confirmed" && outcome.bookingReference) {
        toast.success(outcome.message ?? "نوبت شما ثبت شد.");
        navigated = true;
        router.replace(routes.customer.bookingConfirmation(outcome.bookingReference));
        return;
      }
      if (outcome.outcome === "already_accepted" && outcome.bookingReference) {
        toast.success(outcome.message ?? "این پیشنهاد قبلاً پذیرفته شده است.");
        navigated = true;
        router.replace(routes.customer.bookingConfirmation(outcome.bookingReference));
        return;
      }
      if (outcome.outcome === "hold_created") {
        writeHoldReference(outcome.holdReference);
        toast.success(outcome.message ?? "رزرو موقت ایجاد شد.");
        navigated = true;
        router.replace(routes.customer.bookingHold(outcome.holdReference));
        return;
      }
      if (outcome.outcome === "payment_required") {
        if (outcome.holdReference) writeHoldReference(outcome.holdReference);
        toast.success(outcome.message ?? "برای قطعی شدن نوبت پرداخت لازم است.");
        navigated = true;
        router.replace(routes.customer.bookingPayment);
        return;
      }
      if (outcome.outcome === "expired") {
        toast.warning(outcome.message ?? "مهلت این پیشنهاد پایان یافته است.");
        void query.refetch();
        return;
      }
      if (outcome.outcome === "slot_taken") {
        toast.error(outcome.message ?? "این زمان دیگر در دسترس نیست.");
        void query.refetch();
        return;
      }
      toast.error(outcome.message ?? "پذیرش پیشنهاد کامل نشد.");
      acceptKey.current = createIdempotencyKey();
      void query.refetch();
    } catch (err) {
      acceptKey.current = createIdempotencyKey();
      toast.error(toAppApiError(err).message || "پذیرش پیشنهاد ناموفق بود.");
    } finally {
      if (!navigated) {
        acceptLock.current = false;
        setAccepting(false);
      }
    }
  }

  async function onReject() {
    if (rejectLock.current || !offer) return;
    rejectLock.current = true;
    setRejecting(true);
    try {
      await rejectWaitingListOffer(offer.publicReference, rejectKey.current);
      invalidateWaitingListCaches(queryClient, user?.id);
      toast.success(
        offer.rejectClosesEntry
          ? "پیشنهاد رد شد و درخواست لیست انتظار بسته شد."
          : "پیشنهاد رد شد. درخواست لیست انتظار فعال می‌ماند.",
      );
      setRejectOpen(false);
      if (offer.entryReference) {
        router.replace(routes.customer.waitingListEntry(offer.entryReference));
      } else {
        router.replace(routes.customer.waitingList);
      }
    } catch (err) {
      rejectKey.current = createIdempotencyKey();
      toast.error(toAppApiError(err).message || "رد پیشنهاد ناموفق بود.");
    } finally {
      rejectLock.current = false;
      setRejecting(false);
    }
  }

  return (
    <div className="waiting-list-page">
      <PageHeader
        title="پیشنهاد زمان"
        description="پذیرش پیشنهاد ممکن است به تأیید نوبت، رزرو موقت یا پرداخت منجر شود."
      />

      {query.isPending ? <WaitingListSkeleton count={2} /> : null}
      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="پیشنهاد در دسترس نیست"
            description="این پیشنهاد پیدا نشد یا دسترسی به آن ندارید."
          />
        ) : (
          <ApiErrorState
            title="پیشنهاد بارگذاری نشد"
            description={error.message}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && offer ? (
        <section className="waiting-list-offer" aria-labelledby="wl-offer-title">
          <div className="waiting-list-card__status">
            <Badge tone={offer.status === "pending" ? "warning" : "neutral"}>
              {offer.statusLabel}
            </Badge>
          </div>
          <h2 id="wl-offer-title">{offer.service.name}</h2>
          <p>
            <time dateTime={offer.startsAt}>{offer.whenLabel}</time>
          </p>
          {offer.durationLabel ? <p>{offer.durationLabel}</p> : null}
          {offer.providerName ? <p>متخصص: {offer.providerName}</p> : null}
          {offer.branchName ? <p>شعبه: {offer.branchName}</p> : null}
          {offer.priceLabel ? <p>مبلغ: {offer.priceLabel}</p> : null}
          {offer.depositLabel ? <p>بیعانه: {offer.depositLabel}</p> : null}
          {offer.policyWarning ? (
            <Alert tone="warning" title="توجه" description={offer.policyWarning} />
          ) : null}

          {!terminal ? (
            <OfferCountdown
              expiresAt={offer.expiresAt}
              serverNow={offer.serverNow}
              receivedAt={receivedAt}
              onExpired={onExpired}
            />
          ) : null}

          <div className="waiting-list-offer__actions">
            <Button
              loading={accepting}
              disabled={!canAct}
              onClick={() => void onAccept()}
            >
              پذیرش پیشنهاد
            </Button>
            {offer.canReject && !terminal ? (
              <Button variant="secondary" onClick={() => setRejectOpen(true)}>
                رد پیشنهاد
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={routes.customer.waitingList}>بازگشت</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={rejectOpen}
        title="رد پیشنهاد زمان"
        description={
          offer?.rejectClosesEntry
            ? "با رد این پیشنهاد، کل درخواست لیست انتظار بسته می‌شود."
            : "فقط همین پیشنهاد رد می‌شود و درخواست لیست انتظار فعال می‌ماند."
        }
        confirmLabel="رد پیشنهاد"
        cancelLabel="انصراف"
        busy={rejecting}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => void onReject()}
      />
    </div>
  );
}
