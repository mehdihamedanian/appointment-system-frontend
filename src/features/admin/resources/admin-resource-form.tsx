"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { pickFieldError } from "@/lib/auth/form";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  adminResourceConflictMessage,
  isAdminResourceConflict,
  isDuplicateResourceError,
  isInternalOperationalResourceType,
} from "@/lib/admin/resource-adapter";
import { invalidateAfterAdminResourceMutation } from "@/lib/admin/resource-cache";
import {
  createAdminResource,
  updateAdminResource,
} from "@/lib/api/admin-resources";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBranches, fetchPublicBusiness } from "@/lib/api/public";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import {
  ADMIN_RESOURCE_SCHEDULE_MODE_LABELS,
  ADMIN_RESOURCE_TYPE_LABELS,
  ADMIN_RESOURCE_TYPES,
  type AdminResourceDetailView,
  type AdminResourceFormInput,
  type AdminResourceScheduleMode,
  type AdminResourceType,
} from "@/types/admin-resource";

function formFromDetail(detail?: AdminResourceDetailView | null): AdminResourceFormInput {
  return {
    type: detail?.type && detail.type !== "unknown" ? detail.type : "room",
    name: detail?.name ?? "",
    description: detail?.description ?? "",
    capacity: detail?.capacity?.value,
    branchId: detail?.branch?.id,
    scheduleMode: detail?.schedule.mode !== "unknown" ? detail?.schedule.mode : "inherit_business",
    customerVisible: detail?.customerVisible ?? false,
    version: detail?.version,
  };
}

export function AdminResourceForm({
  userId,
  mode,
  reference,
  initial,
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminResourceDetailView | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const [form, setForm] = useState<AdminResourceFormInput>(() => formFromDetail(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(formFromDetail(initial)));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AdminResourceFormInput, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();

  const dirty = JSON.stringify(form) !== baseline;

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const multiBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true;
  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    enabled: multiBranch,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const capacityEditable = initial?.capacity?.editable !== false;
  const showCustomerVisible =
    form.type === "staff" &&
    (initial?.capabilities.canSetCustomerVisible !== false);
  /** Phase 29 owns staff creation; do not invent staff via the generic resource form. */
  const createTypeOptions = ADMIN_RESOURCE_TYPES.filter((type) => type !== "staff");
  const typeOptions =
    mode === "create"
      ? createTypeOptions
      : form.type === "staff"
        ? (["staff"] as AdminResourceType[])
        : createTypeOptions;

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!form.name.trim()) next.name = "نام منبع را وارد کنید.";
    if (!form.type || form.type === "unknown") next.type = "نوع منبع را انتخاب کنید.";
    if (mode === "create" && form.type === "staff") {
      next.type = "ایجاد کارمند از این فرم پشتیبانی نمی‌شود. از ماژول کارکنان استفاده کنید.";
    }
    if (typeof form.capacity === "number") {
      const min = initial?.capacity?.min ?? 0;
      const max = initial?.capacity?.max;
      if (form.capacity < min) next.capacity = `حداقل ظرفیت ${min} است.`;
      if (max !== undefined && form.capacity > max) next.capacity = `حداکثر ظرفیت ${max} است.`;
    }
    if (multiBranch && !form.branchId && initial?.capabilities.hasBranch !== false) {
      next.branchId = "شعبه را انتخاب کنید.";
    }
    if (isInternalOperationalResourceType(form.type) && form.customerVisible) {
      next.customerVisible = "منابع داخلی نمی‌توانند برای مشتری نمایش داده شوند.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || submitting) return;
    if (!validate()) return;
    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    setConflict(undefined);
    const key = createIdempotencyKey();
    try {
      const payload: AdminResourceFormInput = {
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        customerVisible: showCustomerVisible ? form.customerVisible : undefined,
      };
      const result =
        mode === "create"
          ? await createAdminResource(payload, key)
          : await updateAdminResource(reference!, payload, key);
      invalidateAfterAdminResourceMutation(queryClient, userId, result.reference, {
        affectsCustomerVisibleProvider:
          result.type === "staff" && result.customerVisible,
      });
      setBaseline(JSON.stringify(formFromDetail(result)));
      toast.success(mode === "create" ? "منبع ایجاد شد." : "منبع ذخیره شد.");
      router.push(routes.admin.resourceDetail(result.reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isAdminResourceConflict(apiError) || isDuplicateResourceError(apiError)) {
        if (isDuplicateResourceError(apiError)) {
          setFormError(apiError.message || "منبع تکراری است.");
        } else {
          setConflict(adminResourceConflictMessage());
        }
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("مجوز این عملیات را ندارید.");
        return;
      }
      if (isNotFoundError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isValidationError(apiError)) {
        setFieldErrors({
          name: pickFieldError(apiError.fieldErrors, ["name", "title"]),
          type: pickFieldError(apiError.fieldErrors, ["type", "resourceType"]),
          capacity: pickFieldError(apiError.fieldErrors, ["capacity"]),
          branchId: pickFieldError(apiError.fieldErrors, ["branchId", "branch"]),
          description: pickFieldError(apiError.fieldErrors, ["description"]),
          scheduleMode: pickFieldError(apiError.fieldErrors, ["scheduleMode"]),
        });
        setFormError(apiError.fieldErrors ? undefined : apiError.message);
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function requestLeave(href: string) {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingHref(href);
    setLeaveOpen(true);
  }

  if (businessQuery.isError) {
    return <ApiErrorState title="اطلاعات کسب‌وکار دریافت نشد" onRetry={() => void businessQuery.refetch()} />;
  }

  return (
    <>
      <form className="admin-resource-form" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error" title="ذخیره انجام نشد" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

        <FormField id="resourceType" label="نوع منبع" required error={fieldErrors.type}>
          <Select
            id="resourceType"
            value={form.type}
            disabled={mode === "edit" || submitting}
            options={typeOptions.map((type) => ({
              value: type,
              label: ADMIN_RESOURCE_TYPE_LABELS[type],
            }))}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                type: (value as AdminResourceType) ?? "room",
                customerVisible:
                  value === "staff" ? current.customerVisible : false,
              }))
            }
          />
        </FormField>

        {mode === "create" ? (
          <Alert
            tone="info"
            title="مرز کارکنان"
            description="ایجاد و پرونده کارکنان در فاز ۲۹ است. این فرم فقط منابع عملیاتی داخلی (اتاق، دستگاه، …) را می‌سازد."
          />
        ) : null}

        {form.type === "staff" && mode === "edit" ? (
          <Alert
            tone="info"
            title="مرز کارکنان"
            description="تخصص، مرخصی و پرونده شغلی در ماژول کارکنان (فاز ۲۹) مدیریت می‌شود. اینجا فقط مرجع زمان‌بندی مشترک است."
          />
        ) : null}

        <FormField id="resourceName" label="نام" required error={fieldErrors.name}>
          <Input
            id="resourceName"
            value={form.name}
            disabled={submitting}
            invalid={Boolean(fieldErrors.name)}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>

        <FormField id="resourceDescription" label="توضیحات" error={fieldErrors.description}>
          <Textarea
            id="resourceDescription"
            rows={3}
            value={form.description ?? ""}
            disabled={submitting}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </FormField>

        {capacityEditable ? (
          <FormField
            id="resourceCapacity"
            label="ظرفیت"
            description={
              initial?.capacity?.semanticsLabel ??
              "معنی ظرفیت را Backend تعیین می‌کند؛ فرض نکنید برابر تعداد نوبت است."
            }
            error={fieldErrors.capacity}
          >
            <Input
              id="resourceCapacity"
              type="number"
              className="ltr-value"
              dir="ltr"
              value={form.capacity ?? ""}
              disabled={submitting}
              invalid={Boolean(fieldErrors.capacity)}
              onChange={(event) => {
                const raw = event.target.value;
                setForm((current) => ({
                  ...current,
                  capacity: raw === "" ? undefined : Number(raw),
                }));
              }}
            />
          </FormField>
        ) : null}

        {multiBranch ? (
          <FormField id="resourceBranch" label="شعبه" required error={fieldErrors.branchId}>
            {branchesQuery.isPending ? <InlineLoading label="بارگذاری شعب" /> : null}
            <Select
              id="resourceBranch"
              value={form.branchId}
              disabled={submitting || branchesQuery.isPending}
              options={(branchesQuery.data ?? []).map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              onChange={(value) => setForm((current) => ({ ...current, branchId: value }))}
            />
          </FormField>
        ) : (
          <p className="ds-help">شعبه به‌صورت خودکار از پیکربندی تک‌شعبه‌ای کسب‌وکار اعمال می‌شود.</p>
        )}

        <FormField id="resourceScheduleMode" label="حالت زمان‌بندی" error={fieldErrors.scheduleMode}>
          <Select
            id="resourceScheduleMode"
            value={form.scheduleMode ?? "inherit_business"}
            disabled={submitting}
            options={(["inherit_business", "inherit_branch", "custom"] as AdminResourceScheduleMode[]).map(
              (modeValue) => ({
                value: modeValue,
                label: ADMIN_RESOURCE_SCHEDULE_MODE_LABELS[modeValue],
              }),
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                scheduleMode: (value as AdminResourceScheduleMode) ?? "inherit_business",
              }))
            }
          />
          <p className="ds-help">
            ویرایش کامل ساعات کاری در فاز ۳۲ انجام می‌شود. اینجا فقط حالت وراثت ثبت می‌شود.
          </p>
        </FormField>

        {showCustomerVisible ? (
          <Switch
            label="نمایش برای مشتری به‌عنوان ارائه‌دهنده"
            description="فقط برای کارکنان/ارائه‌دهندگان انسانی. منابع داخلی هرگز به مشتری نمایش داده نمی‌شوند."
            checked={Boolean(form.customerVisible)}
            disabled={submitting}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, customerVisible: checked }))
            }
          />
        ) : null}

        <div className="booking-wizard__nav">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() =>
              requestLeave(
                mode === "edit" && reference
                  ? routes.admin.resourceDetail(reference)
                  : routes.admin.resources,
              )
            }
          >
            انصراف
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "ایجاد منبع" : "ذخیره تغییرات"}
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
          const href = pendingHref ?? routes.admin.resources;
          setLeaveOpen(false);
          router.push(href);
        }}
      />
    </>
  );
}
