"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
} from "@/lib/admin/resource-adapter";
import { invalidateAfterAdminResourceMutation } from "@/lib/admin/resource-cache";
import {
  adminResourceTypesQueryOptions,
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
  ADMIN_RESOURCE_TYPE_LABELS,
  type AdminResourceDetailView,
  type AdminResourceFormInput,
} from "@/types/admin-resource";

function formFromDetail(detail?: AdminResourceDetailView | null): AdminResourceFormInput {
  return {
    type: detail?.type ?? "unknown",
    name: detail?.name ?? "",
    description: detail?.description ?? "",
    capacity: detail?.capacity?.value,
    branchId: detail?.branch?.id,
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
  const typesQuery = useQuery({
    ...adminResourceTypesQueryOptions(userId),
    enabled: mode === "create" && Boolean(userId),
  });

  /** Staff and specialists are created in the staff module, which also creates their StaffProfile. */
  const typeOptions = (typesQuery.data ?? []).filter((option) => !option.human);
  const selectedType =
    typeOptions.find((option) => option.id === form.resourceTypeId) ??
    typeOptions.find((option) => option.code === "room") ??
    typeOptions[0];

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

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!form.name.trim()) next.name = "نام منبع را وارد کنید.";
    if (mode === "create" && !selectedType) next.resourceTypeId = "نوع منبع را انتخاب کنید.";
    if (typeof form.capacity === "number") {
      const min = initial?.capacity?.min ?? 1;
      const max = initial?.capacity?.max;
      if (form.capacity < min) next.capacity = `حداقل ظرفیت ${min} است.`;
      if (max !== undefined && form.capacity > max) next.capacity = `حداکثر ظرفیت ${max} است.`;
    }
    if (multiBranch && !form.branchId && initial?.capabilities.hasBranch !== false) {
      next.branchId = "شعبه را انتخاب کنید.";
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
        type: mode === "create" && selectedType ? selectedType.type : form.type,
        resourceTypeId: mode === "create" ? selectedType?.id : undefined,
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
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
          resourceTypeId: pickFieldError(apiError.fieldErrors, [
            "resource_type_id",
            "resourceTypeId",
            "type",
          ]),
          capacity: pickFieldError(apiError.fieldErrors, ["capacity"]),
          branchId: pickFieldError(apiError.fieldErrors, ["branch_ids", "branchId", "branch"]),
          description: pickFieldError(apiError.fieldErrors, ["description"]),
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

  if (businessQuery.isError && !isNotFoundError(toAppApiError(businessQuery.error))) {
    return <ApiErrorState title="اطلاعات کسب‌وکار دریافت نشد" onRetry={() => void businessQuery.refetch()} />;
  }
  if (mode === "create" && typesQuery.isError) {
    const error = toAppApiError(typesQuery.error);
    return (
      <ApiErrorState
        title="انواع منبع دریافت نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void typesQuery.refetch()}
      />
    );
  }

  return (
    <>
      <form className="admin-resource-form" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error" title="ذخیره انجام نشد" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

        <FormField id="resourceType" label="نوع منبع" required error={fieldErrors.resourceTypeId}>
          {mode === "create" ? (
            <>
              {typesQuery.isPending ? <InlineLoading label="بارگذاری انواع منبع" /> : null}
              <Select
                id="resourceType"
                value={selectedType?.id}
                disabled={submitting || typesQuery.isPending}
                options={typeOptions.map((option) => ({ value: option.id, label: option.label }))}
                onChange={(value) => setForm((current) => ({ ...current, resourceTypeId: value }))}
              />
            </>
          ) : (
            <Select
              id="resourceType"
              value={form.type}
              disabled
              options={[
                {
                  value: form.type,
                  label: initial?.typeLabel ?? ADMIN_RESOURCE_TYPE_LABELS[form.type],
                },
              ]}
              onChange={() => undefined}
            />
          )}
        </FormField>

        {mode === "create" ? (
          <Alert
            tone="info"
            title="مرز کارکنان"
            description="کارکنان و متخصصان از ماژول کارکنان ایجاد می‌شوند. این فرم فقط منابع عملیاتی (اتاق، دستگاه، …) را می‌سازد."
          />
        ) : null}

        {form.type === "staff" && mode === "edit" ? (
          <Alert
            tone="info"
            title="مرز کارکنان"
            description="تخصص، مرخصی و پرونده شغلی در ماژول کارکنان مدیریت می‌شود. اینجا فقط مرجع زمان‌بندی مشترک است."
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
        ) : null}

        <p className="ds-help">ساعات کاری، استراحت و زمان‌های مسدود این منبع از صفحهٔ زمان‌بندی آن مدیریت می‌شود.</p>

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
          <Button
            type="submit"
            loading={submitting}
            disabled={mode === "create" && typesQuery.isPending}
          >
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
