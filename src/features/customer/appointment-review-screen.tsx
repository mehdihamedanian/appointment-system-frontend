"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormError, Label } from "@/components/ui/form-field";
import { StarRating } from "@/components/ui/star-rating";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
  PermissionDeniedState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { PageHeader } from "@/components/layout/page-header";
import { useToast } from "@/components/feedback/toast";
import { AppointmentReviewSkeleton } from "@/features/customer/appointment-review-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  appointmentReviewQueryOptions,
  isReviewEndpointDisconnected,
  submitAppointmentReview,
} from "@/lib/api/appointment-review";
import {
  ApiError,
  isConflictError,
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import {
  normalizeReviewComment,
  validateReviewForm,
} from "@/lib/customer/appointment-review-adapter";
import { appointmentProviderLabel } from "@/lib/customer/appointment-detail-adapter";
import { invalidateAfterReviewSubmit } from "@/lib/customer/review-cache";
import {
  reviewIdempotencyKey,
  reviewIntentFingerprint,
} from "@/lib/customer/review-idempotency";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes, LOGIN_PATH } from "@/constants/routes";
import type {
  AppointmentReviewEligibilityView,
  AppointmentReviewView,
} from "@/types/appointment-review";

function ReviewDisplay({
  review,
  heading = "نظر ثبت‌شده",
}: {
  review: AppointmentReviewView;
  heading?: string;
}) {
  return (
    <section className="appointment-review-card" aria-labelledby="review-submitted-title">
      <h2 id="review-submitted-title" className="text-card-title">
        {heading}
      </h2>
      <div className="appointment-review-card__status">
        <Badge
          tone={
            review.moderationStatus === "published"
              ? "success"
              : review.moderationStatus === "pending_moderation" ||
                  review.moderationStatus === "submitted"
                ? "warning"
                : "neutral"
          }
        >
          {review.moderationStatusLabel}
        </Badge>
        <p className="text-caption">{review.ratingLabel}</p>
      </div>
      {review.moderationStatus === "pending_moderation" ||
      review.moderationStatus === "submitted" ? (
        <Alert
          tone="info"
          title="ثبت شد"
          description="نظر شما ثبت شده و در انتظار بررسی است. ثبت نظر به‌معنای انتشار فوری نیست."
        />
      ) : null}
      {review.comment ? <p className="appointment-review-card__comment">{review.comment}</p> : null}
      {review.submittedLabel ? (
        <p className="text-caption">
          ثبت: <time dateTime={review.submittedAt}>{review.submittedLabel}</time>
        </p>
      ) : null}
      {review.businessResponse ? (
        <div className="appointment-review-card__reply">
          <h3 className="text-caption">پاسخ مجموعه</h3>
          <p>{review.businessResponse}</p>
        </div>
      ) : null}
    </section>
  );
}

function AppointmentContext({ eligibility }: { eligibility: AppointmentReviewEligibilityView }) {
  const when = formatAppointmentParts(eligibility.startsAt, eligibility.timezone);
  const provider = appointmentProviderLabel(eligibility.provider);
  return (
    <section className="appointment-review-card" aria-labelledby="review-context-title">
      <h2 id="review-context-title" className="text-card-title">
        موضوع نظر
      </h2>
      {eligibility.businessName ? <p>{eligibility.businessName}</p> : null}
      <p className="appointment-review-card__service">{eligibility.service.name}</p>
      {when ? (
        <p>
          <time dateTime={eligibility.startsAt}>{when.label}</time>
        </p>
      ) : null}
      {provider ? <p>{provider}</p> : null}
      {eligibility.branch ? <p>{eligibility.branch.name}</p> : null}
      <p className="text-caption">
        کد نوبت:{" "}
        <span className="ltr-value">{eligibility.appointmentReference}</span>
      </p>
      <p className="text-caption">
        نظر شما درباره تجربه خدمت و نوبت است، نه منابع داخلی مجموعه.
      </p>
    </section>
  );
}

export function AppointmentReviewScreen({ reference }: { reference: string }) {
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const featureVisible = isCapabilityVisible(defaultCapabilities, "reviews");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successReview, setSuccessReview] = useState<AppointmentReviewView | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const submitLock = useRef(false);
  const idempotencyStore = useRef<{ fingerprint: string; key: string } | null>(null);
  const successAnnRef = useRef<HTMLSpanElement>(null);

  const query = useQuery({
    ...appointmentReviewQueryOptions(user?.id ?? "anonymous", safe),
    enabled: sessionReady && featureVisible && Boolean(safe),
  });

  if (!safe) {
    return (
      <div className="appointment-review">
        <PageHeader title="ثبت نظر" />
        <NoResultsState title="نوبت پیدا نشد" description="شناسه نوبت معتبر نیست." />
      </div>
    );
  }

  if (!featureVisible) {
    return (
      <div className="appointment-review">
        <PageHeader title="ثبت نظر" />
        <EmptyState
          title="ثبت نظر فعال نیست"
          description="این قابلیت برای مجموعه در حال حاضر غیرفعال است."
          action={
            <Button asChild>
              <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به نوبت</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="appointment-review">
        <PageHeader title="ثبت نظر" description="برای ثبت نظر ابتدا وارد شوید." />
        {status === "expired" || status === "unauthenticated" ? (
          <SessionExpiredState
            action={
              <Button asChild>
                <Link href={`${LOGIN_PATH}?next=${encodeURIComponent(routes.customer.appointmentReview(safe))}`}>
                  ورود
                </Link>
              </Button>
            }
          />
        ) : (
          <AppointmentReviewSkeleton />
        )}
      </div>
    );
  }

  const eligibility = query.data;
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const displayReview = successReview ?? eligibility?.existingReview;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || !eligibility?.canReview) return;
    const constraints = eligibility.constraints;
    const errors = validateReviewForm({ rating, comment }, constraints);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    const normalizedComment = normalizeReviewComment(comment);
    const fingerprint = reviewIntentFingerprint(safe, rating!, normalizedComment);
    const key = reviewIdempotencyKey(idempotencyStore, fingerprint);
    try {
      // Refresh eligibility before submit when still eligible path.
      const fresh = await query.refetch();
      if (fresh.data && !fresh.data.canReview) {
        setFormError(
          fresh.data.reason ??
            (fresh.data.alreadyReviewed
              ? "برای این نوبت قبلاً نظر ثبت شده است."
              : "مهلت یا امکان ثبت نظر دیگر برقرار نیست."),
        );
        return;
      }
      const result = await submitAppointmentReview(
        safe,
        {
          rating: rating!,
          comment: normalizedComment || undefined,
        },
        key,
      );
      invalidateAfterReviewSubmit(queryClient, user!.id, safe);
      setSuccessReview(result.review);
      setSuccessMessage(
        result.message ??
          (result.review.moderationStatus === "published"
            ? "نظر شما ثبت و منتشر شد."
            : "نظر شما ثبت شد و در انتظار بررسی است."),
      );
      toast.success("نظر شما با موفقیت ثبت شد.");
    } catch (err) {
      const normalized = toAppApiError(err);
      if (isConflictError(normalized) || normalized.code?.toUpperCase().includes("DUPLICATE")) {
        setFormError(normalized.message || "برای این نوبت قبلاً نظر ثبت شده است.");
        void query.refetch();
      } else if (
        normalized.code?.toUpperCase().includes("EXPIRED") ||
        normalized.code?.toUpperCase().includes("NOT_ELIGIBLE")
      ) {
        setFormError(normalized.message || "امکان ثبت نظر دیگر وجود ندارد.");
        void query.refetch();
      } else if (err instanceof ApiError && err.fieldErrors) {
        const next: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if (messages?.[0]) next[field] = messages[0];
        }
        setFieldErrors(next);
        setFormError(normalized.message);
      } else {
        setFormError(normalized.message);
        idempotencyStore.current = null;
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="appointment-review">
      <PageHeader
        title="ثبت نظر"
        description="نظر شما درباره تجربه خدمت در این مجموعه است."
        breadcrumb={
          <nav aria-label="مسیر صفحه">
            <ol className="ds-breadcrumb">
              <li>
                <Link href={routes.customer.appointments}>نوبت‌ها</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <Link href={routes.customer.appointmentDetail(safe)}>جزئیات نوبت</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <span aria-current="page">نظر</span>
              </li>
            </ol>
          </nav>
        }
        secondaryActions={
          <Button asChild variant="ghost">
            <Link href={routes.customer.appointmentDetail(safe)}>
              <ArrowRight size={16} aria-hidden="true" />
              بازگشت
            </Link>
          </Button>
        }
      />

      <span className="visually-hidden" aria-live="polite" ref={successAnnRef}>
        {successMessage ?? ""}
      </span>

      {query.isPending ? <AppointmentReviewSkeleton /> : null}

      {error ? (
        isSessionExpiredError(error) ? (
          <SessionExpiredState />
        ) : isForbiddenError(error) || isNotFoundError(error) ? (
          isReviewEndpointDisconnected(query.error) ? (
            <EmptyState
              title="ثبت نظر هنوز متصل نیست"
              description="سرویس نظرسنجی مشتری هنوز در دسترس نیست."
              action={
                <Button asChild>
                  <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به نوبت</Link>
                </Button>
              }
            />
          ) : (
            <PermissionDeniedState
              title="امکان ثبت نظر نیست"
              description="این نوبت پیدا نشد یا اجازه ثبت نظر ندارید."
            />
          )
        ) : (
          <ApiErrorState
            title="اطلاعات نظر بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && eligibility ? (
        <>
          <AppointmentContext eligibility={eligibility} />

          {displayReview ? (
            <ReviewDisplay
              review={displayReview}
              heading={successReview ? "نظر با موفقیت ثبت شد" : "نظر قبلی شما"}
            />
          ) : null}

          {!displayReview && !eligibility.canReview ? (
            <EmptyState
              title="امکان ثبت نظر نیست"
              description={
                eligibility.reason ??
                (eligibility.alreadyReviewed
                  ? "برای این نوبت قبلاً نظر ثبت شده است."
                  : "این نوبت در حال حاضر واجد شرایط ثبت نظر نیست.")
              }
              action={
                <Button asChild>
                  <Link href={routes.customer.appointmentDetail(safe)}>بازگشت به نوبت</Link>
                </Button>
              }
            />
          ) : null}

          {eligibility.canReview && !displayReview ? (
            <form className="appointment-review-form" onSubmit={(event) => void onSubmit(event)} noValidate>
              {eligibility.deadlineLabel ? (
                <Alert tone="info" title="مهلت" description={eligibility.deadlineLabel} />
              ) : null}
              {eligibility.publicIdentityPolicy ? (
                <Alert
                  tone="info"
                  title="حریم خصوصی انتشار"
                  description={eligibility.publicIdentityPolicy}
                />
              ) : null}

              <StarRating
                name="appointment-rating"
                value={rating}
                onChange={setRating}
                min={eligibility.constraints.ratingMin}
                max={eligibility.constraints.ratingMax}
                legend="امتیاز تجربه شما"
                description={`از ${eligibility.constraints.ratingMin} تا ${eligibility.constraints.ratingMax}`}
                error={fieldErrors.rating}
                required
                disabled={submitting}
              />

              <div className="ds-field">
                <Label
                  htmlFor="review-comment"
                  required={eligibility.constraints.commentRequired}
                  optional={!eligibility.constraints.commentRequired}
                >
                  نظر متنی
                </Label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={eligibility.constraints.commentMaxLength}
                  invalid={Boolean(fieldErrors.comment)}
                  disabled={submitting}
                  rows={5}
                />
                {fieldErrors.comment ? <FormError>{fieldErrors.comment}</FormError> : null}
              </div>

              {formError ? (
                <Alert tone="error" title="ثبت نظر انجام نشد" description={formError} />
              ) : null}

              <div className="appointment-review-form__footer">
                <Button asChild variant="secondary">
                  <Link href={routes.customer.appointmentDetail(safe)}>انصراف</Link>
                </Button>
                <Button type="submit" loading={submitting}>
                  ارسال نظر
                </Button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
