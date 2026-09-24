"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  adminBranchConflictMessage,
  adminBranchDuplicateMessage,
  branchFormImpactFields,
  formFromAdminBranchDetail,
  isAdminBranchConflict,
  isDuplicateBranchError,
  validateAdminBranchForm,
} from "@/lib/admin/branch-adapter";
import { invalidateAfterAdminBranchMutation } from "@/lib/admin/branch-cache";
import { adminBranchDetailHref } from "@/lib/admin/branch-filters";
import {
  createAdminBranch,
  updateAdminBranch,
} from "@/lib/api/admin-branches";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import {
  ADMIN_BRANCH_SCHEDULE_MODE_LABELS,
  type AdminBranchDetailView,
  type AdminBranchFormErrors,
  type AdminBranchFormInput,
  type AdminBranchScheduleMode,
} from "@/types/admin-branch";

const SCHEDULE_OPTIONS = (["inherit_business", "custom"] as const).map((value) => ({
  value,
  label: ADMIN_BRANCH_SCHEDULE_MODE_LABELS[value],
}));

export function AdminBranchForm({
  userId,
  mode,
  reference,
  initial,
  supportsTimezone,
  supportsCoordinates,
  supportsMapUrl,
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminBranchDetailView | null;
  supportsTimezone?: boolean;
  supportsCoordinates?: boolean;
  supportsMapUrl?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const baselineForm = formFromAdminBranchDetail(initial);
  const [form, setForm] = useState<AdminBranchFormInput>(() => baselineForm);
  const [baseline] = useState(() => JSON.stringify(baselineForm));
  const [fieldErrors, setFieldErrors] = useState<AdminBranchFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();

  const dirty = JSON.stringify(form) !== baseline;
  useUnsavedChangesWarning(dirty && !submitting);

  function patch(next: Partial<AdminBranchFormInput>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function requestLeave(href: string) {
    if (dirty && !submitting) {
      setPendingHref(href);
      setLeaveOpen(true);
      return;
    }
    router.push(href);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    setFormError(undefined);
    setConflict(undefined);
    const errors = validateAdminBranchForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await saveForm();
  }

  async function saveForm() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    const idempotencyKey = createIdempotencyKey();
    const changedFields = branchFormImpactFields(form, baselineForm);
    try {
      const result =
        mode === "create"
          ? await createAdminBranch(form, idempotencyKey)
          : await updateAdminBranch(reference!, form, idempotencyKey);

      invalidateAfterAdminBranchMutation(queryClient, userId, result.reference, {
        changedFields,
        affectsAvailability: changedFields.some((f) =>
          ["timezone", "scheduleMode", "status"].includes(f),
        ),
      });
      toast.success(mode === "create" ? "شعبه ایجاد شد." : "تغییرات ذخیره شد.");
      router.push(adminBranchDetailHref(result.reference));
    } catch (error) {
      const appError = toAppApiError(error);
      if (isSessionExpiredError(appError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isForbiddenError(appError)) {
        setFormError("دسترسی کافی برای ذخیره ندارید.");
        return;
      }
      if (isAdminBranchConflict(appError)) {
        setConflict(adminBranchConflictMessage());
        return;
      }
      if (isDuplicateBranchError(appError)) {
        setFormError(adminBranchDuplicateMessage());
        return;
      }
      if (isValidationError(appError)) {
        setFormError(appError.message);
        return;
      }
      if (isNotFoundError(appError)) {
        setFormError("سرویس شعب هنوز به Backend متصل نشده است.");
        return;
      }
      setFormError(appError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="admin-branch-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

        <FormField id="branch-name" label="نام شعبه" required error={fieldErrors.name}>
          <Input
            id="branch-name"
            value={form.name}
            disabled={submitting}
            invalid={Boolean(fieldErrors.name)}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </FormField>

        <FormField id="branch-public-title" label="عنوان عمومی" description="اختیاری — برای نمایش به مشتری">
          <Input
            id="branch-public-title"
            value={form.publicTitle ?? ""}
            disabled={submitting}
            onChange={(event) => patch({ publicTitle: event.target.value })}
          />
        </FormField>

        <FormField id="branch-address" label="آدرس" error={fieldErrors.address}>
          <Textarea
            id="branch-address"
            value={form.address ?? ""}
            disabled={submitting}
            onChange={(event) => patch({ address: event.target.value })}
          />
        </FormField>

        <FormField id="branch-phone" label="تلفن" error={fieldErrors.phone}>
          <PhoneInput
            id="branch-phone"
            value={form.phone ?? ""}
            disabled={submitting}
            onValueChange={(value) => patch({ phone: value })}
          />
        </FormField>

        {supportsCoordinates ? (
          <div className="admin-branch-form__coords">
            <FormField id="branch-lat" label="عرض جغرافیایی" error={fieldErrors.location}>
              <Input
                id="branch-lat"
                className="ltr-value"
                inputMode="decimal"
                value={form.location?.latitude?.toString() ?? ""}
                disabled={submitting}
                onChange={(event) =>
                  patch({
                    location: {
                      ...form.location,
                      latitude: event.target.value ? Number(event.target.value) : undefined,
                    },
                  })
                }
              />
            </FormField>
            <FormField id="branch-lng" label="طول جغرافیایی">
              <Input
                id="branch-lng"
                className="ltr-value"
                inputMode="decimal"
                value={form.location?.longitude?.toString() ?? ""}
                disabled={submitting}
                onChange={(event) =>
                  patch({
                    location: {
                      ...form.location,
                      longitude: event.target.value ? Number(event.target.value) : undefined,
                    },
                  })
                }
              />
            </FormField>
          </div>
        ) : null}

        {supportsMapUrl ? (
          <FormField id="branch-map-url" label="لینک نقشه" description="URL عمومی — بدون وابستگی SDK">
            <Input
              id="branch-map-url"
              className="ltr-value"
              value={form.location?.mapUrl ?? ""}
              disabled={submitting}
              onChange={(event) =>
                patch({ location: { ...form.location, mapUrl: event.target.value || undefined } })
              }
            />
          </FormField>
        ) : null}

        {supportsTimezone ? (
          <FormField id="branch-timezone" label="منطقه زمانی" description="فقط در صورت مجاز بودن Backend">
            <Input
              id="branch-timezone"
              className="ltr-value"
              value={form.timezone ?? ""}
              disabled={submitting}
              onChange={(event) => patch({ timezone: event.target.value })}
            />
          </FormField>
        ) : null}

        <FormField id="branch-schedule-mode" label="حالت زمان‌بندی">
          <Select
            id="branch-schedule-mode"
            value={form.scheduleMode === "unknown" ? "inherit_business" : form.scheduleMode}
            disabled={submitting}
            options={SCHEDULE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(value) => patch({ scheduleMode: (value as AdminBranchScheduleMode) ?? "inherit_business" })}
          />
        </FormField>
        <p className="ds-help">
          ویرایش کامل ساعات در{" "}
          {mode === "edit" && reference ? (
            <a href={routes.admin.branchSchedule(reference)}>صفحه زمان‌بندی شعبه</a>
          ) : (
            "صفحه جزئیات پس از ایجاد"
          )}{" "}
          (فاز ۳۲).
        </p>

        <div className="booking-wizard__nav">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() =>
              requestLeave(
                mode === "edit" && reference
                  ? adminBranchDetailHref(reference)
                  : routes.admin.branches,
              )
            }
          >
            انصراف
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "ایجاد شعبه" : "ذخیره تغییرات"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={leaveOpen}
        title="تغییرات ذخیره نشده"
        description="با ترک صفحه، تغییرات ذخیره‌نشده از بین می‌روند."
        confirmLabel="ترک صفحه"
        cancelLabel="ماندن"
        onCancel={() => {
          setLeaveOpen(false);
          setPendingHref(undefined);
        }}
        onConfirm={() => {
          router.push(pendingHref ?? routes.admin.branches);
        }}
      />

    </>
  );
}
