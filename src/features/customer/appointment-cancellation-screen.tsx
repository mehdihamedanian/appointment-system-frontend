"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/selection";
import { FormError, Label } from "@/components/ui/form-field";
import {
  ApiErrorState,
  NoResultsState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { PageHeader } from "@/components/layout/page-header";
import { CancellationAppointmentSummary } from "@/features/customer/cancellation-appointment-summary";
import { AppointmentCancellationSkeleton } from "@/features/customer/appointment-cancellation-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  cancellationPreviewQueryOptions,
  isCancellationPreviewDisconnected,
  submitAppointmentCancellation,
} from "@/lib/api/appointment-cancellation";
import {
  isForbiddenError,
  isNetworkUncertaintyError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import {
  cancellationSuccessHeadline,
  refundStatusLabel,
  validateCancellationReason,
} from "@/lib/customer/appointment-cancellation-adapter";
import { invalidateAfterCancellation } from "@/lib/customer/cancellation-cache";
import {
  cancellationConflictMessage,
  isAlreadyCancelledError,
  isPolicyChangedError,
  isRefundChangedError,
} from "@/lib/customer/cancellation-errors";
import {
  cancellationIdempotencyKey,
  cancellationIntentFingerprint,
} from "@/lib/customer/cancellation-idempotency";
import { appointmentsHref } from "@/lib/customer/appointment-category";
import { EXTERNAL_LINK_REL } from "@/lib/public/links";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes, LOGIN_PATH } from "@/constants/routes";
import { DEFAULT_CANCELLATION_REASON_MAX_LENGTH } from "@/types/appointment-cancellation";
import type {
  CancellationPreviewView,
  CancellationResultView,
} from "@/types/appointment-cancellation";
import type { PolicySnapshot } from "@/types/appointment-detail";
import type { AppApiError } from "@/types/api";

function PolicyBlock({ policy }: { policy: PolicySnapshot }) {
  if (!policy.title && !policy.summary && !policy.deadlineLabel && !policy.feeLabel && !policy.refundLabel) {
    return null;
  }
  return (
    <section className="appointment-cancel-card" aria-labelledby="cancellation-policy">
      <h2 id="cancellation-policy" className="text-card-title">
        {policy.title ?? "سیاست لغو"}
      </h2>
      {policy.summary ? <p>{policy.summary}</p> : null}
      <dl className="booking-summary-list">
        {policy.deadlineLabel ? (
          <div>
            <dt>مهلت</dt>
            <dd>{policy.deadlineLabel}</dd>
          </div>
        ) : null}
        {policy.feeLabel ? (
          <div>
            <dt>هزینه لغو</dt>
            <dd className="ltr-value">{policy.feeLabel}</dd>
          </div>
        ) : null}
        {policy.refundLabel ? (
          <div>
            <dt>بازپرداخت</dt>
            <dd>{policy.refundLabel}</dd>
          </div>
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

function RefundBlock({ preview }: { preview: CancellationPreviewView }) {
  const { refund } = preview;
  const hasAmounts = Boolean(
    refund.paidAmount?.label || refund.cancellationFee?.label || refund.refundableAmount?.label,
  );
  if (refund.status === "none" && !hasAmounts && !refund.note) {
    return null;
  }
  return (
    <section className="appointment-cancel-card" aria-labelledby="cancellation-refund">
      <h2 id="cancellation-refund" className="text-card-title">
        بازپرداخت
      </h2>
      <p>{refundStatusLabel(refund.status)}</p>
      {refund.note ? <p className="text-caption">{refund.note}</p> : null}
      <dl className="booking-summary-list">
        {refund.paidAmount?.label ? (
          <div>
            <dt>مبلغ پرداخت‌شده</dt>
            <dd className="ltr-value">{refund.paidAmount.label}</dd>
          </div>
        ) : null}
        {refund.cancellationFee?.label ? (
          <div>
            <dt>هزینه لغو</dt>
            <dd className="ltr-value">{refund.cancellationFee.label}</dd>
          </div>
        ) : null}
        {refund.refundableAmount?.label ? (
          <div>
            <dt>مبلغ قابل بازپرداخت</dt>
            <dd className="ltr-value">{refund.refundableAmount.label}</dd>
          </div>
        ) : null}
        {refund.methodLabel ? (
          <div>
            <dt>روش بازپرداخت</dt>
            <dd>{refund.methodLabel}</dd>
          </div>
        ) : null}
        {refund.processingEstimate ? (
          <div>
            <dt>زمان تقریبی</dt>
            <dd>{refund.processingEstimate}</dd>
          </div>
        ) : null}
      </dl>
      {refund.status === "pending_calculation" ? (
        <p className="text-caption">مبلغ بازپرداخت هنوز نهایی نشده است.</p>
      ) : null}
    </section>
  );
}

function CancellationSuccess({
  result,
  reference,
}: {
  result: CancellationResultView;
  reference: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headline = cancellationSuccessHeadline(result.refund);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="appointment-cancel">
      <header className="appointment-cancel__success" aria-live="polite">
        <p className="text-caption">لغو نوبت</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-page-title">
          {headline.title}
        </h1>
        <p>{headline.description}</p>
      </header>
      <section className="appointment-cancel-card">
        <dl className="booking-summary-list">
          <div>
            <dt>کد رزرو</dt>
            <dd>
              <span className="ltr-value">{result.appointmentReference}</span>
            </dd>
          </div>
          {result.cancellationReference ? (
            <div>
              <dt>شماره پیگیری لغو</dt>
              <dd>
                <span className="ltr-value">{result.cancellationReference}</span>
              </dd>
            </div>
          ) : null}
          {result.cancelledAt ? (
            <div>
              <dt>زمان لغو</dt>
              <dd>
                <time dateTime={result.cancelledAt}>{result.cancelledAt}</time>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>وضعیت بازپرداخت</dt>
            <dd>{refundStatusLabel(result.refund.status)}</dd>
          </div>
          {result.refund.refundableAmount?.label &&
          (result.refund.status === "full" || result.refund.status === "partial") ? (
            <div>
              <dt>مبلغ بازپرداخت</dt>
              <dd className="ltr-value">{result.refund.refundableAmount.label}</dd>
            </div>
          ) : null}
        </dl>
        {result.message ? <p>{result.message}</p> : null}
      </section>
      <div className="appointment-cancel__actions">
        <Button asChild>
          <Link href={routes.customer.appointmentDetail(reference)}>مشاهده نوبت</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={appointmentsHref({ category: "cancelled" })}>نوبت‌های لغوشده</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={routes.customer.booking}>رزرو نوبت جدید</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={routes.customer.dashboard}>بازگشت به داشبورد</Link>
        </Button>
      </div>
    </div>
  );
}

export function AppointmentCancellationScreen({ reference }: { reference: string }) {
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const reviewAnnouncerRef = useRef<HTMLSpanElement>(null);
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";

  const [selectedReason, setSelectedReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<AppApiError>();
  const [conflictMessage, setConflictMessage] = useState<string>();
  const [result, setResult] = useState<CancellationResultView>();
  const [alreadyCancelled, setAlreadyCancelled] = useState(false);

  const previewQuery = useQuery({
    ...cancellationPreviewQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe) && !result && !alreadyCancelled,
  });

  const preview = previewQuery.data;
  const reasonMaxLength = preview?.reasonMaxLength ?? DEFAULT_CANCELLATION_REASON_MAX_LENGTH;
  const selectedOption = preview?.allowedReasons?.find((item) => item.code === selectedReason);
  const showReasonText = !preview?.allowedReasons?.length || selectedOption?.requiresText === true;

  async function onSubmit() {
    if (!preview || !safe || submitLock.current || submitting) {
      return;
    }
    const validation = validateCancellationReason({
      allowedReasons: preview.allowedReasons,
      selectedCode: selectedReason || undefined,
      reasonText: showReasonText ? reasonText : undefined,
      maxLength: reasonMaxLength,
    });
    if (validation) {
      setReasonError(validation);
      return;
    }
    setReasonError(undefined);
    setSubmitError(undefined);
    setConflictMessage(undefined);
    submitLock.current = true;
    setSubmitting(true);
    try {
      const fingerprint = cancellationIntentFingerprint(safe, preview.previewVersion);
      const key = cancellationIdempotencyKey(idempotencyRef, fingerprint);
      const response = await submitAppointmentCancellation(
        safe,
        {
          reasonCode: selectedReason || undefined,
          reasonText: showReasonText ? reasonText.trim() || undefined : undefined,
          previewVersion: preview.previewVersion,
        },
        key,
      );
      invalidateAfterCancellation(queryClient, userId, safe);
      setResult(response);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAlreadyCancelledError(normalized)) {
        setAlreadyCancelled(true);
        invalidateAfterCancellation(queryClient, userId, safe);
        return;
      }
      if (isPolicyChangedError(normalized) || isRefundChangedError(normalized)) {
        const message = cancellationConflictMessage(normalized);
        setSubmitError(undefined);
        await previewQuery.refetch();
        setConflictMessage(message);
        setSelectedReason("");
        setReasonText("");
        idempotencyRef.current = undefined;
        reviewAnnouncerRef.current?.focus();
        return;
      }
      const conflict = cancellationConflictMessage(normalized);
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

  if (!safe) {
    return <NoResultsState title="نوبت پیدا نشد" description="شناسه نوبت معتبر نیست." />;
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="appointment-cancel">
        <PageHeader title="لغو نوبت" description="پس از ورود، پیش‌نمایش لغو نمایش داده می‌شود." />
        <AppointmentCancellationSkeleton />
      </div>
    );
  }

  if (result) {
    return <CancellationSuccess result={result} reference={safe} />;
  }

  if (alreadyCancelled) {
    return (
      <div className="appointment-cancel">
        <NoResultsState
          title="این نوبت قبلاً لغو شده است"
          description="وضعیت فعلی را در جزئیات نوبت یا فهرست لغوشده‌ها ببینید."
          action={
            <Button asChild>
              <Link href={routes.customer.appointmentDetail(safe)}>مشاهده نوبت</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (previewQuery.isPending) {
    return (
      <div className="appointment-cancel">
        <PageHeader
          title="لغو نوبت"
          breadcrumb={
            <Link href={routes.customer.appointmentDetail(safe)} className="appointment-cancel__back">
              <ArrowRight size={16} aria-hidden="true" />
              بازگشت به جزئیات نوبت
            </Link>
          }
        />
        <AppointmentCancellationSkeleton />
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
          title="لغو این نوبت ممکن نیست"
          description="این نوبت در دسترس نیست یا مجوز لغو ندارید."
        />
      );
    }
    return (
      <ApiErrorState
        title={
          isCancellationPreviewDisconnected(error)
            ? "پیش‌نمایش لغو هنوز متصل نیست"
            : "دریافت پیش‌نمایش لغو ممکن نشد"
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

  const canSubmit =
    preview.canCancel &&
    !submitting &&
    !validateCancellationReason({
      allowedReasons: preview.allowedReasons,
      selectedCode: selectedReason || undefined,
      reasonText: showReasonText ? reasonText : undefined,
      maxLength: reasonMaxLength,
    });

  return (
    <div className="appointment-cancel">
      <PageHeader
        title="لغو نوبت"
        description="قبل از لغو، جزئیات نوبت، سیاست و بازپرداخت را بررسی کنید."
        breadcrumb={
          <Link href={routes.customer.appointmentDetail(safe)} className="appointment-cancel__back">
            <ArrowRight size={16} aria-hidden="true" />
            بازگشت به جزئیات نوبت
          </Link>
        }
      />
      <span ref={reviewAnnouncerRef} tabIndex={-1} className="visually-hidden" aria-live="polite">
        {conflictMessage ?? ""}
      </span>
      <span className="visually-hidden" aria-live="polite">
        {submitting ? "در حال ثبت درخواست لغو." : ""}
      </span>

      {!preview.canCancel ? (
        <Alert
          tone="warning"
          title="لغو این نوبت مجاز نیست"
          description={preview.blockedReason ?? "این نوبت در حال حاضر قابل لغو نیست."}
          action={
            <Button variant="secondary" asChild>
              <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به جزئیات</Link>
            </Button>
          }
        />
      ) : null}

      {conflictMessage ? (
        <Alert tone="warning" title="تغییر در شرایط لغو" description={conflictMessage} />
      ) : null}

      {submitError ? (
        <ApiErrorState
          title={
            isNetworkUncertaintyError(submitError)
              ? "اتصال قطع شد؛ وضعیت لغو نامشخص است"
              : "لغو نوبت انجام نشد"
          }
          description={submitError.message}
          requestId={submitError.requestId}
          onRetry={() => void onSubmit()}
        />
      ) : null}

      <div className="appointment-cancel__layout">
        <div className="appointment-cancel__main">
          <CancellationAppointmentSummary appointment={preview.appointment} />
          <PolicyBlock policy={preview.policy} />
          <RefundBlock preview={preview} />
          {preview.canCancel ? (
            <section className="appointment-cancel-card" aria-labelledby="cancellation-reason">
              <h2 id="cancellation-reason" className="text-card-title">
                دلیل لغو
              </h2>
              {preview.allowedReasons?.length ? (
                <RadioGroup legend="دلیل لغو را انتخاب کنید" error={reasonError}>
                  {preview.allowedReasons.map((item) => (
                    <Radio
                      key={item.code}
                      name={`cancel-reason-${safe}`}
                      value={item.code}
                      checked={selectedReason === item.code}
                      onChange={() => {
                        setSelectedReason(item.code);
                        setReasonError(undefined);
                      }}
                      label={item.label}
                    />
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-caption">دلیل لغو اختیاری است.</p>
              )}
              {showReasonText ? (
                <div className="ds-stack" style={{ gap: "var(--space-2)" }}>
                  <Label htmlFor="cancellation-reason-text" optional={!selectedOption?.requiresText}>
                    {selectedOption?.requiresText ? "توضیح دلیل" : "یادداشت (اختیاری)"}
                  </Label>
                  <Textarea
                    id="cancellation-reason-text"
                    value={reasonText}
                    maxLength={selectedOption?.maxLength ?? reasonMaxLength}
                    onChange={(event) => {
                      setReasonText(event.target.value);
                      setReasonError(undefined);
                    }}
                    rows={4}
                  />
                  {reasonError ? <FormError>{reasonError}</FormError> : null}
                </div>
              ) : reasonError ? (
                <FormError>{reasonError}</FormError>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {preview.canCancel ? (
        <div className="appointment-cancel__footer">
          <Button variant="secondary" asChild disabled={submitting}>
            <Link href={routes.customer.appointmentDetail(safe)}>نگه‌داشتن نوبت</Link>
          </Button>
          <Button variant="destructive" loading={submitting} disabled={!canSubmit} onClick={() => void onSubmit()}>
            لغو نوبت
          </Button>
        </div>
      ) : null}
    </div>
  );
}
