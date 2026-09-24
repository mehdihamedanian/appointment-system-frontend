"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/selection";
import { FormError, Label } from "@/components/ui/form-field";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CancellationAppointmentSummary } from "@/features/customer/cancellation-appointment-summary";
import { AppointmentCancellationSkeleton } from "@/features/customer/appointment-cancellation-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminCancellationPreviewQueryOptions,
  submitAdminCancellation,
} from "@/lib/api/admin-appointments";
import {
  isForbiddenError,
  isNotFoundError,
  toAppApiError,
} from "@/lib/api/errors";
import {
  refundStatusLabel,
  validateCancellationReason,
} from "@/lib/customer/appointment-cancellation-adapter";
import { invalidateAfterAdminCancellation } from "@/lib/admin/appointment-cache";
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
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import {
  DEFAULT_CANCELLATION_REASON_MAX_LENGTH,
  type CancellationResultView,
} from "@/types/appointment-cancellation";

export function AdminAppointmentCancelScreen({ reference }: { reference: string }) {
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const { status, user } = useSession();
  const safe = isSafePublicId(reference) ? reference : "";
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";

  const [selectedReason, setSelectedReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string>();
  const [result, setResult] = useState<CancellationResultView>();

  const previewQuery = useQuery({
    ...adminCancellationPreviewQueryOptions(userId, safe),
    enabled: sessionReady && Boolean(safe) && !result,
  });

  const preview = previewQuery.data;
  const reasonMaxLength = preview?.reasonMaxLength ?? DEFAULT_CANCELLATION_REASON_MAX_LENGTH;
  const selectedOption = preview?.allowedReasons?.find((item) => item.code === selectedReason);
  const showReasonText = !preview?.allowedReasons?.length || selectedOption?.requiresText === true;

  async function onSubmit() {
    if (!preview || !safe || submitLock.current || submitting) return;
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
    setConflictMessage(undefined);
    submitLock.current = true;
    setSubmitting(true);
    try {
      const fingerprint = cancellationIntentFingerprint(safe, preview.previewVersion);
      const key = cancellationIdempotencyKey(idempotencyRef, fingerprint);
      const response = await submitAdminCancellation(
        safe,
        {
          reasonCode: selectedReason || undefined,
          reasonText: showReasonText ? reasonText.trim() || undefined : undefined,
          previewVersion: preview.previewVersion,
        },
        key,
      );
      invalidateAfterAdminCancellation(queryClient, userId, safe);
      setResult(response);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isAlreadyCancelledError(normalized)) {
        invalidateAfterAdminCancellation(queryClient, userId, safe);
        setResult({
          appointmentReference: safe,
          status: "cancelled",
          refund: preview.refund,
        });
        return;
      }
      if (isPolicyChangedError(normalized) || isRefundChangedError(normalized)) {
        setConflictMessage(cancellationConflictMessage(normalized));
        await previewQuery.refetch();
        idempotencyRef.current = undefined;
        return;
      }
      const conflict = cancellationConflictMessage(normalized);
      if (conflict) {
        setConflictMessage(conflict);
        if (normalized.status === 409) await previewQuery.refetch();
        return;
      }
      setReasonError(normalized.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (!safe) {
    return <NoResultsState title="شناسه نوبت نامعتبر است" description="آدرس درخواستی معتبر نیست." />;
  }

  return (
    <PermissionGate permission="admin.appointments.view">
      <AdminPageHeader
        title="لغو نوبت"
        description="پیش‌نمایش تأثیر مالی و عملیاتی از Backend."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.appointmentCancel(safe)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.appointments, label: "نوبت‌ها" },
              { href: routes.admin.appointmentDetail(safe), label: "جزئیات" },
              { label: "لغو" },
            ]}
          />
        }
        secondaryActions={
          <Link href={routes.admin.appointmentDetail(safe)} className="btn btn--ghost btn--sm">
            <ArrowRight className="icon-dir" size={16} aria-hidden="true" />
            بازگشت
          </Link>
        }
      />

      {previewQuery.isPending ? <AppointmentCancellationSkeleton /> : null}

      {previewQuery.isError ? (
        (() => {
          const error = toAppApiError(previewQuery.error);
          if (isForbiddenError(error)) {
            return <PermissionDeniedState description="مجوز لغو این نوبت را ندارید." />;
          }
          if (isNotFoundError(error)) {
            return (
              <ApiErrorState
                title="پیش‌نمایش لغو در دسترس نیست"
                description="Backend هنوز endpoint لغو مدیریتی را ارائه نکرده است."
                onRetry={() => void previewQuery.refetch()}
              />
            );
          }
          return (
            <ApiErrorState
              title="پیش‌نمایش بارگذاری نشد"
              description={error.message}
              onRetry={() => void previewQuery.refetch()}
            />
          );
        })()
      ) : null}

      {result ? (
        <section className="admin-appointment-cancel-result ds-card">
          <h2 className="text-card-title">نوبت لغو شد</h2>
          <p>{refundStatusLabel(result.refund.status)}</p>
          {result.message ? <p>{result.message}</p> : null}
          <Button asChild>
            <Link href={routes.admin.appointmentDetail(safe)}>بازگشت به جزئیات</Link>
          </Button>
        </section>
      ) : null}

      {preview && !result ? (
        <div className="admin-appointment-cancel">
          {conflictMessage ? (
            <Alert tone="warning" title="شرایط تغییر کرد" description={conflictMessage} />
          ) : null}
          <CancellationAppointmentSummary appointment={preview.appointment} />
          {preview.policy.summary ? (
            <section className="ds-card">
              <h2 className="text-card-title">{preview.policy.title ?? "سیاست لغو"}</h2>
              <p>{preview.policy.summary}</p>
              {preview.policy.feeLabel ? (
                <p>
                  هزینه: <span className="ltr-value">{preview.policy.feeLabel}</span>
                </p>
              ) : null}
              {preview.policy.refundLabel ? <p>{preview.policy.refundLabel}</p> : null}
            </section>
          ) : null}
          {preview.allowedReasons && preview.allowedReasons.length > 0 ? (
            <section className="ds-card">
              <h2 className="text-card-title">دلیل لغو</h2>
              <RadioGroup legend="دلیل لغو">
                {preview.allowedReasons.map((option) => (
                  <Radio
                    key={option.code}
                    name={`admin-cancel-reason-${safe}`}
                    value={option.code}
                    label={option.label}
                    checked={selectedReason === option.code}
                    onChange={() => setSelectedReason(option.code)}
                  />
                ))}
              </RadioGroup>
            </section>
          ) : null}
          {showReasonText ? (
            <div>
              <Label htmlFor="admin-cancel-reason-text">توضیح</Label>
              <Textarea
                id="admin-cancel-reason-text"
                value={reasonText}
                maxLength={reasonMaxLength}
                rows={3}
                onChange={(event) => {
                  setReasonText(event.target.value);
                  setReasonError(undefined);
                }}
              />
            </div>
          ) : null}
          {reasonError ? <FormError>{reasonError}</FormError> : null}
          <Button
            variant="destructive"
            disabled={!preview.canCancel || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            لغو نوبت
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            title="تأیید لغو نوبت"
            description="تأثیر مالی و آزادسازی زمان طبق Backend اعمال می‌شود. ادامه می‌دهید؟"
            confirmLabel="لغو نوبت"
            busy={submitting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void onSubmit()}
          />
        </div>
      ) : null}
    </PermissionGate>
  );
}
