"use client";

import { useRef, useState } from "react";
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
import { WaitingListSkeleton } from "@/features/customer/waiting-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  invalidateWaitingListCaches,
  leaveWaitingList,
  waitingListEntryQueryOptions,
} from "@/lib/api/customer-waiting-list";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";

export function WaitingListEntryScreen({ reference: referenceProp }: { reference?: string } = {}) {
  const params = useParams<{ entryReference?: string }>();
  const reference =
    referenceProp ??
    (typeof params.entryReference === "string" ? params.entryReference : "");
  const valid = isSafePublicId(reference) ? reference : "";
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveLock = useRef(false);
  const leaveKey = useRef(createIdempotencyKey());

  const query = useQuery({
    ...waitingListEntryQueryOptions(user?.id ?? "anonymous", valid),
    enabled: sessionReady && Boolean(valid),
  });

  if (!valid) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="جزئیات درخواست" />
        <NoResultsState
          title="درخواست پیدا نشد"
          description="شناسه درخواست معتبر نیست."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.customer.waitingList}>بازگشت</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="جزئیات درخواست" />
        <WaitingListSkeleton count={2} />
      </div>
    );
  }

  const error = query.isError ? toAppApiError(query.error) : undefined;
  const entry = query.data;

  async function onLeave() {
    if (leaveLock.current || !entry) return;
    leaveLock.current = true;
    setLeaving(true);
    try {
      await leaveWaitingList(entry.publicReference, leaveKey.current);
      invalidateWaitingListCaches(queryClient, user!.id);
      toast.success("درخواست لیست انتظار لغو شد.");
      setLeaveOpen(false);
      router.replace(routes.customer.waitingList);
    } catch (err) {
      leaveKey.current = createIdempotencyKey();
      toast.error(toAppApiError(err).message || "لغو درخواست ناموفق بود.");
    } finally {
      leaveLock.current = false;
      setLeaving(false);
    }
  }

  return (
    <div className="waiting-list-page">
      <PageHeader
        title="جزئیات درخواست لیست انتظار"
        description="این درخواست نوبت قطعی نیست."
        breadcrumb={
          <nav aria-label="مسیر صفحه">
            <ol className="ds-breadcrumb">
              <li>
                <Link href={routes.customer.waitingList}>لیست انتظار</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <span aria-current="page">جزئیات</span>
              </li>
            </ol>
          </nav>
        }
      />

      {query.isPending ? <WaitingListSkeleton count={2} /> : null}
      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="درخواست در دسترس نیست"
            description="این درخواست پیدا نشد یا دسترسی به آن ندارید."
          />
        ) : (
          <ApiErrorState
            title="جزئیات بارگذاری نشد"
            description={error.message}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && entry ? (
        <section className="waiting-list-detail" aria-labelledby="wl-entry-title">
          <div className="waiting-list-card__status">
            <Badge tone="primary">{entry.statusLabel}</Badge>
          </div>
          <h2 id="wl-entry-title">{entry.service.name}</h2>
          <Alert
            tone="info"
            title="نوبت قطعی نیست"
            description="تا زمان پیشنهاد و پذیرش، نوبتی برای شما ثبت نمی‌شود."
          />
          {entry.branch ? <p>شعبه: {entry.branch.name}</p> : null}
          {entry.datePreferenceLabel ? <p>{entry.datePreferenceLabel}</p> : null}
          {entry.timePreferenceLabel ? <p>{entry.timePreferenceLabel}</p> : null}
          {entry.note ? <p>یادداشت: {entry.note}</p> : null}
          <p className="text-caption">
            کد: <span className="ltr-value">{entry.publicReference}</span>
          </p>
          {entry.activeOffer ? (
            <Alert
              tone="warning"
              title="پیشنهاد زمان فعال"
              description={entry.activeOffer.whenLabel}
              action={
                <Button asChild size="sm">
                  <Link href={routes.customer.waitingListOffer(entry.activeOffer.publicReference)}>
                    مشاهده پیشنهاد
                  </Link>
                </Button>
              }
            />
          ) : null}
          <div className="waiting-list-card__actions">
            {entry.canLeave ? (
              <Button variant="destructive" onClick={() => setLeaveOpen(true)}>
                ترک لیست انتظار
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={routes.customer.waitingList}>بازگشت به فهرست</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={leaveOpen}
        title="ترک لیست انتظار"
        description={
          entry?.activeOffer
            ? "با ترک لیست انتظار، پیشنهاد فعال نیز از بین می‌رود و درخواست شما بسته می‌شود."
            : "درخواست لیست انتظار شما بسته می‌شود. برای پیوستن دوباره باید درخواست جدید ثبت کنید."
        }
        confirmLabel="ترک لیست انتظار"
        cancelLabel="انصراف"
        busy={leaving}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => void onLeave()}
      />
    </div>
  );
}
