"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/selection";
import {
  ApiErrorState,
  NoResultsState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { PageHeader } from "@/components/layout/page-header";
import { AppointmentRescheduleSkeleton } from "@/features/customer/appointment-reschedule-skeleton";
import { RescheduleComparison } from "@/features/customer/reschedule-comparison";
import { RescheduleCurrentSummary } from "@/features/customer/reschedule-current-summary";
import { RescheduleDateStep } from "@/features/customer/reschedule-date-step";
import { RescheduleTimeStep } from "@/features/customer/reschedule-time-step";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { AppointmentContactBusiness } from "@/features/customer/appointment-contact-business";
import { useSession } from "@/features/auth/session-provider";
import {
  isReschedulePreviewDisconnected,
  reschedulePreviewQueryOptions,
  rescheduleQuoteQueryOptions,
  submitAppointmentReschedule,
} from "@/lib/api/appointment-reschedule";
import {
  isForbiddenError,
  isNetworkUncertaintyError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import {
  financialAdjustmentLabel,
  formatRescheduleWhen,
  rescheduleSuccessHeadline,
} from "@/lib/customer/appointment-reschedule-adapter";
import { invalidateAfterReschedule } from "@/lib/customer/reschedule-cache";
import {
  isReschedulePaymentRequiredError,
  isReschedulePreviewChangedError,
  isRescheduleSlotTakenError,
  rescheduleConflictMessage,
} from "@/lib/customer/reschedule-errors";
import {
  rescheduleIdempotencyKey,
  rescheduleIntentFingerprint,
} from "@/lib/customer/reschedule-idempotency";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type { RescheduleResultView } from "@/types/appointment-reschedule";
import type { ProviderPreference } from "@/types/provider";
import type { AppApiError } from "@/types/api";

function RescheduleSuccess({
  result,
  reference,
}: {
  result: RescheduleResultView;
  reference: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headline = rescheduleSuccessHeadline(result.financial);
  const when = formatRescheduleWhen(result.startsAt, result.endsAt, result.timezone);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="appointment-reschedule">
      <header className="appointment-reschedule__success" aria-live="polite">
        <p className="text-caption">زمان‌بندی مجدد</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-page-title">
          {headline.title}
        </h1>
        <p>{headline.description}</p>
      </header>
      <section className="appointment-reschedule-card">
        <dl className="booking-summary-list">
          <div>
            <dt>کد رزرو</dt>
            <dd>
              <span className="ltr-value">{result.appointmentReference}</span>
            </dd>
          </div>
          <div>
            <dt>تاریخ جدید</dt>
            <dd>{when.date ?? <span className="ltr-value">{result.startsAt}</span>}</dd>
          </div>
          <div>
            <dt>ساعت جدید</dt>
            <dd className="ltr-value">{when.range ?? when.time}</dd>
          </div>
          {result.branchName ? (
            <div>
              <dt>محل مراجعه</dt>
              <dd>{result.branchName}</dd>
            </div>
          ) : null}
          <div>
            <dt>وضعیت مالی</dt>
            <dd>{financialAdjustmentLabel(result.financial)}</dd>
          </div>
        </dl>
        {result.message ? <p>{result.message}</p> : null}
      </section>
      <div className="appointment-reschedule__actions">
        <Button asChild>
          <Link href={routes.customer.appointmentDetail(reference)}>مشاهده نوبت</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={routes.customer.appointments}>بازگشت به نوبت‌های من</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={routes.customer.dashboard}>بازگشت به داشبورد</Link>
        </Button>
      </div>
    </div>
  );
}

export function AppointmentRescheduleScreen({ reference }: { reference: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const conflictAnnouncerRef = useRef<HTMLSpanElement>(null);
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [preferenceOverride, setPreferenceOverride] = useState<ProviderPreference | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<AppApiError>();
  const [conflictMessage, setConflictMessage] = useState<string>();
  const [result, setResult] = useState<RescheduleResultView>();

  const previewQuery = useQuery({
    ...reschedulePreviewQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe) && !result,
  });

  const preview = previewQuery.data;
  const activeBranchId = preview?.selection.branchId;
  const activePreference =
    preferenceOverride ?? preview?.selection.providerPreference ?? { type: "not_applicable" as const };

  const quoteInput =
    selectedDate && selectedSlotId
      ? {
          slotId: selectedSlotId,
          date: selectedDate,
          branchId: activeBranchId,
          providerId: bookingProviderId(activePreference),
          previewVersion: preview?.previewVersion,
        }
      : null;

  const quoteQuery = useQuery({
    ...rescheduleQuoteQueryOptions(userId, safe, quoteInput),
    enabled: sessionReady && Boolean(safe) && Boolean(quoteInput) && preview?.canReschedule === true,
  });

  const quote = quoteQuery.data;
  const requiresAck =
    quote?.requiresAcknowledgment === true || preview?.requiresAcknowledgment === true;
  const ackLabel =
    quote?.acknowledgmentLabel ??
    preview?.acknowledgmentLabel ??
    "شرایط زمان‌بندی مجدد را مطالعه کردم و می‌پذیرم.";

  function clearSlotSelection() {
    setSelectedSlotId(null);
    setAcknowledged(false);
    idempotencyRef.current = undefined;
  }

  function onDateChange(date: string | null) {
    setSelectedDate(date);
    clearSlotSelection();
    setConflictMessage(undefined);
  }

  function onPreferenceChange(next: ProviderPreference | undefined) {
    if (next) {
      setPreferenceOverride(next);
      clearSlotSelection();
      setSelectedDate(null);
      setConflictMessage(undefined);
    }
  }

  async function onSubmit() {
    if (!preview || !safe || !selectedDate || !selectedSlotId || submitLock.current || submitting) {
      setSubmitted(true);
      return;
    }
    if (requiresAck && !acknowledged) {
      setSubmitted(true);
      return;
    }
    setSubmitted(true);
    setSubmitError(undefined);
    setConflictMessage(undefined);
    submitLock.current = true;
    setSubmitting(true);
    try {
      const version = quote?.previewVersion ?? preview.previewVersion;
      const fingerprint = rescheduleIntentFingerprint(safe, selectedSlotId, version);
      const key = rescheduleIdempotencyKey(idempotencyRef, fingerprint);
      const response = await submitAppointmentReschedule(
        safe,
        {
          slotId: selectedSlotId,
          date: selectedDate,
          branchId: activeBranchId,
          providerId: bookingProviderId(activePreference),
          previewVersion: version,
          acknowledged: requiresAck ? acknowledged : undefined,
        },
        key,
      );
      invalidateAfterReschedule(queryClient, userId, safe);
      if (
        response.paymentRequired &&
        (response.financial.payHref || response.financial.holdReference)
      ) {
        if (response.financial.payHref) {
          router.push(response.financial.payHref);
          return;
        }
        if (response.financial.holdReference) {
          router.push(routes.customer.bookingPayment);
          return;
        }
      }
      setResult(response);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isRescheduleSlotTakenError(normalized)) {
        setConflictMessage(rescheduleConflictMessage(normalized));
        clearSlotSelection();
        await quoteQuery.refetch();
        conflictAnnouncerRef.current?.focus();
        return;
      }
      if (isReschedulePreviewChangedError(normalized)) {
        setConflictMessage(rescheduleConflictMessage(normalized));
        clearSlotSelection();
        await previewQuery.refetch();
        conflictAnnouncerRef.current?.focus();
        return;
      }
      if (isReschedulePaymentRequiredError(normalized)) {
        setSubmitError(normalized);
        return;
      }
      const conflict = rescheduleConflictMessage(normalized);
      if (conflict) {
        setConflictMessage(conflict);
        if (normalized.status === 409) {
          await previewQuery.refetch();
        }
      } else {
        setSubmitError(normalized);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const canSubmit =
    preview?.canReschedule &&
    Boolean(selectedDate && selectedSlotId) &&
    quoteQuery.isSuccess &&
    Boolean(quote) &&
    (!requiresAck || acknowledged) &&
    !submitting;

  if (!safe) {
    return <NoResultsState title="نوبت پیدا نشد" description="شناسه نوبت معتبر نیست." />;
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="appointment-reschedule">
        <PageHeader title="زمان‌بندی مجدد" description="پس از ورود، امکان زمان‌بندی مجدد بررسی می‌شود." />
        <AppointmentRescheduleSkeleton />
      </div>
    );
  }

  if (result) {
    return <RescheduleSuccess result={result} reference={safe} />;
  }

  if (previewQuery.isPending) {
    return (
      <div className="appointment-reschedule">
        <PageHeader
          title="زمان‌بندی مجدد"
          breadcrumb={
            <Link href={routes.customer.appointmentDetail(safe)} className="appointment-reschedule__back">
              <ArrowRight size={16} aria-hidden="true" />
              بازگشت به جزئیات نوبت
            </Link>
          }
        />
        <AppointmentRescheduleSkeleton />
      </div>
    );
  }

  if (previewQuery.isError) {
    const error = toAppApiError(previewQuery.error);
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
      return (
        <NoResultsState
          title="زمان‌بندی مجدد این نوبت ممکن نیست"
          description="این نوبت در دسترس نیست یا مجوز زمان‌بندی مجدد ندارید."
        />
      );
    }
    return (
      <ApiErrorState
        title={
          isReschedulePreviewDisconnected(error)
            ? "پیش‌نمایش زمان‌بندی مجدد هنوز متصل نیست"
            : "دریافت پیش‌نمایش زمان‌بندی مجدد ممکن نشد"
        }
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void previewQuery.refetch()}
      />
    );
  }

  if (!preview) {
    return null;
  }

  if (!preview.canReschedule) {
    return (
      <div className="appointment-reschedule">
        <PageHeader title="زمان‌بندی مجدد" />
        <Alert
          tone="warning"
          title="زمان‌بندی مجدد مجاز نیست"
          description={preview.blockedReason ?? "این نوبت در حال حاضر قابل زمان‌بندی مجدد نیست."}
        />
        <RescheduleCurrentSummary appointment={preview.appointment} />
        {preview.contact ? <AppointmentContactBusiness contact={preview.contact} /> : null}
        <div className="appointment-reschedule__actions">
          <Button asChild>
            <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به جزئیات نوبت</Link>
          </Button>
        </div>
      </div>
    );
  }

  const selection = preview.selection;

  return (
    <div className="appointment-reschedule">
      <PageHeader
        title="زمان‌بندی مجدد"
        description="زمان جدید را انتخاب کنید. نوبت فعلی تا تأیید سرویس تغییر نمی‌کند."
        breadcrumb={
          <Link href={routes.customer.appointmentDetail(safe)} className="appointment-reschedule__back">
            <ArrowRight size={16} aria-hidden="true" />
            بازگشت به جزئیات نوبت
          </Link>
        }
      />
      <span ref={conflictAnnouncerRef} tabIndex={-1} className="visually-hidden" aria-live="polite">
        {conflictMessage ?? ""}
      </span>
      <span className="visually-hidden" aria-live="polite">
        {submitting ? "در حال ثبت زمان‌بندی مجدد." : quoteQuery.isFetching ? "در حال دریافت پیش‌نمایش." : ""}
      </span>

      {conflictMessage ? (
        <Alert tone="warning" title="تغییر در شرایط" description={conflictMessage} />
      ) : null}

      {submitError ? (
        <ApiErrorState
          title={
            isNetworkUncertaintyError(submitError)
              ? "اتصال قطع شد؛ وضعیت زمان‌بندی مجدد نامشخص است"
              : "زمان‌بندی مجدد انجام نشد"
          }
          description={submitError.message}
          requestId={submitError.requestId}
          onRetry={() => void onSubmit()}
        />
      ) : null}

      {preview.warning ? <Alert tone="info" title="توجه" description={preview.warning} /> : null}
      {preview.remainingReschedulesLabel ? (
        <p className="text-caption">{preview.remainingReschedulesLabel}</p>
      ) : null}

      <div className="appointment-reschedule__layout">
        <div className="appointment-reschedule__main">
          <RescheduleCurrentSummary appointment={preview.appointment} />
          {preview.permissions.allowProviderChange ? (
            <section className="appointment-reschedule-card" aria-labelledby="reschedule-provider">
              <h2 id="reschedule-provider" className="text-card-title">
                متخصص
              </h2>
              <ProviderSelectionField
                serviceId={selection.serviceId}
                branchId={activeBranchId}
                value={activePreference}
                onChange={onPreferenceChange}
                submitted={submitted}
              />
            </section>
          ) : null}
          <section className="appointment-reschedule-card" aria-labelledby="reschedule-date">
            <h2 id="reschedule-date" className="text-card-title">
              تاریخ جدید
            </h2>
            <RescheduleDateStep
              reference={safe}
              serviceId={selection.serviceId}
              branchId={activeBranchId}
              preference={activePreference}
              requiresBranch={selection.requiresBranch}
              providerMode={selection.providerMode}
              selected={selectedDate}
              onSelect={onDateChange}
              timezone={selection.timezone}
              submitted={submitted}
            />
          </section>
          <section className="appointment-reschedule-card" aria-labelledby="reschedule-time">
            <h2 id="reschedule-time" className="text-card-title">
              ساعت جدید
            </h2>
            <RescheduleTimeStep
              reference={safe}
              serviceId={selection.serviceId}
              branchId={activeBranchId}
              preference={activePreference}
              requiresBranch={selection.requiresBranch}
              providerMode={selection.providerMode}
              date={selectedDate}
              selectedId={selectedSlotId}
              onSelect={(id) => {
                setSelectedSlotId(id);
                setAcknowledged(false);
                idempotencyRef.current = undefined;
              }}
              timezone={selection.timezone}
              submitted={submitted}
              onPickAnotherDate={() => onDateChange(null)}
            />
          </section>
          {quoteQuery.isError ? (
            <ApiErrorState
              title="دریافت پیش‌نمایش مقایسه ممکن نشد"
              description={toAppApiError(quoteQuery.error).message}
              requestId={toAppApiError(quoteQuery.error).requestId}
              onRetry={() => void quoteQuery.refetch()}
            />
          ) : null}
          {quoteQuery.isFetching && selectedSlotId ? (
            <p className="text-caption" aria-live="polite">
              در حال دریافت پیش‌نمایش مقایسه…
            </p>
          ) : null}
          {quote ? <RescheduleComparison quote={quote} /> : null}
          {requiresAck && quote ? (
            <section className="appointment-reschedule-card">
              <Checkbox
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                label={ackLabel}
              />
              {submitted && !acknowledged ? (
                <p className="ds-error" role="alert">
                  لطفاً شرایط را بپذیرید.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <div className="appointment-reschedule__footer">
        <Button variant="secondary" asChild disabled={submitting}>
          <Link href={routes.customer.appointmentDetail(safe)}>نگه‌داشتن زمان فعلی</Link>
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => void onSubmit()}
        >
          تأیید زمان‌بندی مجدد
        </Button>
      </div>
    </div>
  );
}
