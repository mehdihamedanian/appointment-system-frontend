"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminCustomerConflictMessage,
  adminCustomerDuplicateMessage,
  formFromAdminCustomerDetail,
  isAdminCustomerConflict,
  isDuplicateAdminCustomerError,
  validateAdminCustomerForm,
} from "@/lib/admin/customer-adapter";
import { invalidateAfterAdminCustomerMutation } from "@/lib/admin/customer-cache";
import { adminCustomerDetailHref } from "@/lib/admin/customer-filters";
import { createAdminCustomerRecord, updateAdminCustomer } from "@/lib/api/admin-customers";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type {
  AdminCustomerDetailView,
  AdminCustomerFormErrors,
  AdminCustomerFormInput,
} from "@/types/admin-customer";

export function AdminCustomerForm({
  userId,
  mode,
  reference,
  initial,
  supportsContactOverride,
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminCustomerDetailView | null;
  supportsContactOverride?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const baselineForm = formFromAdminCustomerDetail(initial);
  const [form, setForm] = useState<AdminCustomerFormInput>(() => baselineForm);
  const [baseline] = useState(() => JSON.stringify(baselineForm));
  const [fieldErrors, setFieldErrors] = useState<AdminCustomerFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [duplicateHref, setDuplicateHref] = useState<string>();

  const dirty = JSON.stringify(form) !== baseline;
  const contactChanged =
    mode === "edit" &&
    (form.phone !== baselineForm.phone || form.email !== baselineForm.email);
  const needsOverride =
    contactChanged &&
    (initial?.contact.phoneVerified || initial?.contact.emailVerified) &&
    !supportsContactOverride;

  useUnsavedChangesWarning(dirty && !submitting);

  function patch(next: Partial<AdminCustomerFormInput>) {
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
    if (needsOverride) {
      setFormError("تغییر تماس تأییدشده بدون مجوز Backend امکان‌پذیر نیست.");
      return;
    }
    if (contactChanged && supportsContactOverride && initial?.capabilities.supportsVerifiedContactOverride) {
      setOverrideOpen(true);
      return;
    }
    await saveForm();
  }

  async function saveForm() {
    if (submitLock.current) return;
    const normalized: AdminCustomerFormInput = {
      ...form,
      phone: normalizeIranMobile(form.phone),
    };
    const errors = validateAdminCustomerForm(normalized);
    if (!isValidIranMobile(normalized.phone)) errors.phone = "شماره موبایل معتبر نیست.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    setConflict(undefined);
    setDuplicateHref(undefined);
    try {
      if (mode === "create") {
        const result = await createAdminCustomerRecord(normalized, createIdempotencyKey());
        if (result.outcome === "missing_endpoint") {
          setFormError("ثبت مشتری هنوز به Backend متصل نشده است.");
          return;
        }
        if (result.outcome === "duplicate") {
          setFormError(result.message ?? adminCustomerDuplicateMessage());
          if (result.customer.reference) {
            setDuplicateHref(adminCustomerDetailHref(result.customer.reference));
          }
          return;
        }
        invalidateAfterAdminCustomerMutation(queryClient, userId, result.customer.reference, {
          affectsContact: true,
          affectsManualBookingSearch: true,
        });
        toast.success("مشتری ایجاد شد.");
        router.push(adminCustomerDetailHref(result.customer.reference ?? result.customer.id));
        return;
      }

      const result = await updateAdminCustomer(reference!, normalized, createIdempotencyKey());
      invalidateAfterAdminCustomerMutation(queryClient, userId, result.reference, {
        affectsContact: contactChanged,
        affectsPublicProfile: true,
        affectsManualBookingSearch: true,
      });
      toast.success("تغییرات ذخیره شد.");
      router.push(adminCustomerDetailHref(result.reference));
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
      if (isAdminCustomerConflict(appError)) {
        setConflict(adminCustomerConflictMessage());
        return;
      }
      if (isDuplicateAdminCustomerError(appError)) {
        setFormError(adminCustomerDuplicateMessage());
        return;
      }
      if (isValidationError(appError)) {
        setFormError(appError.message);
        return;
      }
      if (isNotFoundError(appError)) {
        setFormError("سرویس مشتریان هنوز به Backend متصل نشده است.");
        return;
      }
      setFormError(appError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
      setOverrideOpen(false);
    }
  }

  return (
    <>
      <form className="admin-customer-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}
        {duplicateHref ? (
          <p className="ds-help">
            <a href={duplicateHref}>مشاهده مشتری موجود</a>
          </p>
        ) : null}
        {mode === "edit" && contactChanged ? (
          <Alert
            tone="info"
            title="تغییر تماس"
            description="ویرایش شماره یا ایمیل تأییدشده ممکن است نیاز به تأیید مجدد داشته باشد."
          />
        ) : null}

        <FormField id="customer-first-name" label="نام" required error={fieldErrors.firstName}>
          <Input
            id="customer-first-name"
            value={form.firstName}
            disabled={submitting}
            invalid={Boolean(fieldErrors.firstName)}
            onChange={(event) => patch({ firstName: event.target.value })}
          />
        </FormField>

        <FormField id="customer-last-name" label="نام خانوادگی" required error={fieldErrors.lastName}>
          <Input
            id="customer-last-name"
            value={form.lastName}
            disabled={submitting}
            invalid={Boolean(fieldErrors.lastName)}
            onChange={(event) => patch({ lastName: event.target.value })}
          />
        </FormField>

        <FormField id="customer-phone" label="موبایل" required error={fieldErrors.phone}>
          <PhoneInput
            id="customer-phone"
            value={form.phone}
            disabled={submitting || needsOverride}
            onValueChange={(value) => patch({ phone: value })}
          />
        </FormField>

        <FormField id="customer-email" label="ایمیل" error={fieldErrors.email}>
          <Input
            id="customer-email"
            type="email"
            className="ltr-value"
            dir="ltr"
            value={form.email ?? ""}
            disabled={submitting || needsOverride}
            invalid={Boolean(fieldErrors.email)}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </FormField>

        <p className="ds-help">
          ایجاد مشتری به معنی حساب ورود یا تأیید خودکار تماس نیست — مگر Backend صریحاً اعلام کند.
        </p>

        <div className="booking-wizard__nav">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() =>
              requestLeave(
                mode === "edit" && reference
                  ? adminCustomerDetailHref(reference)
                  : routes.admin.customers,
              )
            }
          >
            انصراف
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "ایجاد مشتری" : "ذخیره تغییرات"}
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
        onConfirm={() => router.push(pendingHref ?? routes.admin.customers)}
      />

      <ConfirmDialog
        open={overrideOpen}
        title="تغییر تماس تأییدشده"
        description="این تغییر ممکن است نیاز به تأیید مجدد داشته باشد و در لاudit ثبت شود."
        confirmLabel="ادامه و ذخیره"
        cancelLabel="انصراف"
        onCancel={() => setOverrideOpen(false)}
        onConfirm={() => void saveForm()}
      />
    </>
  );
}
