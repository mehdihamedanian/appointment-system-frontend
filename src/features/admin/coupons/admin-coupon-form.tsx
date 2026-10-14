"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, MultiSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  adminCouponConflictMessage,
  adminCouponDuplicateMessage,
  buildRuleSummary,
  formFromAdminCouponDetail,
  isAdminCouponConflict,
  isDuplicateCouponError,
  validateAdminCouponForm,
} from "@/lib/admin/coupon-adapter";
import { invalidateAfterAdminCouponMutation } from "@/lib/admin/coupon-cache";
import { adminCouponDetailHref } from "@/lib/admin/coupon-filters";
import {
  createAdminCoupon,
  fetchAdminCouponImpactPreview,
  updateAdminCoupon,
} from "@/lib/api/admin-coupons";
import { fetchPublicBranches, fetchPublicBusiness, fetchPublicServiceCatalog } from "@/lib/api/public";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import {
  ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS,
  ADMIN_COUPON_SERVICE_SCOPE_LABELS,
  type AdminCouponDetailView,
  type AdminCouponFormErrors,
  type AdminCouponFormInput,
  type AdminCouponImpactPreview,
} from "@/types/admin-coupon";

export function AdminCouponForm({
  userId,
  mode,
  reference,
  initial,
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminCouponDetailView | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const baselineForm = formFromAdminCouponDetail(initial);
  const [form, setForm] = useState<AdminCouponFormInput>(() => baselineForm);
  const [baseline] = useState(() => JSON.stringify(baselineForm));
  const [errors, setErrors] = useState<AdminCouponFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();
  const [impact, setImpact] = useState<AdminCouponImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const dirty = JSON.stringify(form) !== baseline;
  const allowed = initial?.allowedActions;
  const caps = initial?.capabilities;
  const codeEditable = mode === "create" || allowed?.editCode !== false;
  const discountEditable = mode === "create" || allowed?.editDiscount !== false;
  const restrictionsEditable = mode === "create" || allowed?.editRestrictions !== false;

  useUnsavedChangesWarning(dirty && !submitting);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const currency = businessQuery.data?.currency ?? "IRR";
  const timezoneLabel =
    initial?.timezoneLabel ?? businessQuery.data?.timezone;

  const multiBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true &&
    caps?.supportsBranchRestrictions !== false;

  const servicesQuery = useQuery({
    queryKey: [...queryKeys.publicServices, currency],
    queryFn: ({ signal }) => fetchPublicServiceCatalog(currency, undefined, signal),
    staleTime: 60_000,
  });
  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    enabled: multiBranch,
    staleTime: 60_000,
  });

  const serviceOptions = useMemo(
    () =>
      (servicesQuery.data?.items ?? []).map((service) => ({
        value: service.id,
        label: service.name,
      })),
    [servicesQuery.data?.items],
  );
  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    [branchesQuery.data],
  );

  const ruleSummary = useMemo(
    () =>
      buildRuleSummary({
        discountType: form.discountType,
        discountValueLabel: form.discountValue || "—",
        restrictions: {
          serviceScope: form.serviceScope,
          serviceIds: form.serviceIds,
          serviceLabels: form.serviceIds
            .map((id) => serviceOptions.find((item) => item.value === id)?.label)
            .filter(Boolean) as string[],
          branchIds: form.branchIds,
          branchLabels: form.branchIds
            .map((id) => branchOptions.find((item) => item.value === id)?.label)
            .filter(Boolean) as string[],
          minimumAmountLabel: form.minimumAmount,
          maximumDiscountLabel: form.maximumDiscount,
        },
        startsAtLabel: form.startsAt ? `${form.startsAt} ${form.startsTime}` : undefined,
        endsAtLabel: form.endsAt ? `${form.endsAt} ${form.endsTime}` : undefined,
        timezoneLabel,
        stats: {
          totalUsageLimit: form.totalUsageLimit ? Number(form.totalUsageLimit) : undefined,
        },
      }),
    [form, serviceOptions, branchOptions, timezoneLabel],
  );

  function patch(next: Partial<AdminCouponFormInput>) {
    setForm((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next) as (keyof AdminCouponFormInput)[]) {
        delete copy[key as keyof AdminCouponFormErrors];
      }
      return copy;
    });
  }

  function requestLeave(href: string) {
    if (dirty && !submitting) {
      setPendingHref(href);
      setLeaveOpen(true);
      return;
    }
    router.push(href);
  }

  async function prepareSave(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || submitting) return;
    if (allowed?.processing) {
      setFormError(allowed.blockedReason ?? "عملیات دیگری در حال انجام است.");
      return;
    }

    const validation = validateAdminCouponForm({ ...form, timeZone: timezoneLabel });
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFormError("لطفاً خطاهای فرم را برطرف کنید.");
      return;
    }

    if (
      mode === "edit" &&
      reference &&
      initial?.capabilities.supportsImpactPreview !== false
    ) {
      setImpactLoading(true);
      setFormError(undefined);
      try {
        const preview = await fetchAdminCouponImpactPreview(reference, "edit");
        if (preview.requiresConfirmation) {
          setImpact(preview);
          return;
        }
      } catch (error) {
        const apiError = toAppApiError(error);
        if (!isNotFoundError(apiError)) {
          toast.error(apiError.message);
          return;
        }
      } finally {
        setImpactLoading(false);
      }
    }

    await saveForm();
  }

  async function saveForm() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    setConflict(undefined);
    try {
      if (mode === "create") {
        const created = await createAdminCoupon(
          { ...form, timeZone: timezoneLabel },
          createIdempotencyKey(),
        );
        invalidateAfterAdminCouponMutation(queryClient, userId, created.reference);
        toast.success("کوپن ایجاد شد.");
        router.push(adminCouponDetailHref(created.reference));
        return;
      }

      const updated = await updateAdminCoupon(
        reference!,
        { ...form, timeZone: timezoneLabel },
        createIdempotencyKey(),
        initial?.version,
      );
      invalidateAfterAdminCouponMutation(queryClient, userId, updated.reference);
      toast.success("تغییرات ذخیره شد.");
      router.push(adminCouponDetailHref(updated.reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("دسترسی کافی برای ذخیره ندارید.");
        return;
      }
      if (isAdminCouponConflict(apiError)) {
        setConflict(adminCouponConflictMessage());
        return;
      }
      if (isDuplicateCouponError(apiError)) {
        setErrors((current) => ({ ...current, code: adminCouponDuplicateMessage() }));
        setFormError(adminCouponDuplicateMessage());
        return;
      }
      if (isValidationError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isNotFoundError(apiError)) {
        setFormError("سرویس کوپن هنوز به Backend متصل نشده است.");
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
      setImpact(null);
    }
  }

  return (
    <>
      <form className="admin-coupon-form" onSubmit={(event) => void prepareSave(event)} noValidate>
        {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}
        {allowed?.blockedReason ? (
          <Alert tone="warning" title="محدودیت" description={allowed.blockedReason} />
        ) : null}

        <Card title="شناسه و توضیحات">
          <div className="admin-coupon-form__grid">
            <FormField id="coupon-code" label="کد کوپن" error={errors.code} required>
              <Input
                id="coupon-code"
                name="code"
                value={form.code}
                onChange={(event) => patch({ code: event.target.value })}
                disabled={!codeEditable || submitting}
                invalid={Boolean(errors.code)}
                className="ltr-value"
                autoComplete="off"
              />
            </FormField>
            <FormField id="coupon-title" label="عنوان داخلی" error={errors.title} required>
              <Input
                id="coupon-title"
                name="title"
                value={form.title}
                onChange={(event) => patch({ title: event.target.value })}
                disabled={submitting}
                invalid={Boolean(errors.title)}
              />
            </FormField>
            <FormField id="coupon-internal-description" label="توضیح داخلی" optional>
              <Textarea
                id="coupon-internal-description"
                name="internalDescription"
                value={form.internalDescription ?? ""}
                onChange={(event) => patch({ internalDescription: event.target.value })}
                disabled={submitting}
              />
            </FormField>
            <FormField id="coupon-customer-description" label="توضیح مشتری" optional>
              <Textarea
                id="coupon-customer-description"
                name="customerDescription"
                value={form.customerDescription ?? ""}
                onChange={(event) => patch({ customerDescription: event.target.value })}
                disabled={submitting}
              />
            </FormField>
          </div>
        </Card>

        <Card title="تخفیف">
          <div className="admin-coupon-form__grid">
            <FormField id="coupon-discount-type" label="نوع تخفیف" required>
              <Select
                id="coupon-discount-type"
                value={form.discountType}
                disabled={!discountEditable || submitting}
                options={[
                  { value: "fixed", label: ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS.fixed },
                  { value: "percentage", label: ADMIN_COUPON_DISCOUNT_TYPE_FORM_LABELS.percentage },
                ]}
                onChange={(value) =>
                  patch({ discountType: value === "percentage" ? "percentage" : "fixed" })
                }
              />
            </FormField>
            <FormField
              id="coupon-discount-value"
              label={form.discountType === "percentage" ? "درصد تخفیف" : "مبلغ تخفیف"}
              error={errors.discountValue}
              required
            >
              <Input
                id="coupon-discount-value"
                name="discountValue"
                value={form.discountValue}
                onChange={(event) => patch({ discountValue: event.target.value })}
                disabled={!discountEditable || submitting}
                invalid={Boolean(errors.discountValue)}
                className="ltr-value"
                inputMode={form.discountType === "percentage" ? "decimal" : "numeric"}
              />
            </FormField>
            {form.discountType === "percentage" ? (
              <FormField id="coupon-max-discount" label="حداکثر تخفیف" optional error={errors.maximumDiscount}>
                <Input
                  id="coupon-max-discount"
                  name="maximumDiscount"
                  value={form.maximumDiscount ?? ""}
                  onChange={(event) => patch({ maximumDiscount: event.target.value })}
                  disabled={!discountEditable || submitting}
                  className="ltr-value"
                />
              </FormField>
            ) : null}
            <FormField id="coupon-minimum-amount" label="حداقل مبلغ سبد" optional error={errors.minimumAmount}>
              <Input
                id="coupon-minimum-amount"
                name="minimumAmount"
                value={form.minimumAmount ?? ""}
                onChange={(event) => patch({ minimumAmount: event.target.value })}
                disabled={!discountEditable || submitting}
                className="ltr-value"
              />
            </FormField>
          </div>
        </Card>

        <Card title="اعتبار">
          {timezoneLabel ? (
            <p className="admin-coupon-form__timezone">منطقه زمانی کسب‌وکار: {timezoneLabel}</p>
          ) : null}
          <div className="admin-coupon-form__grid">
            <FormField id="coupon-starts-at" label="شروع" error={errors.startsAt} required>
              <div className="admin-coupon-form__datetime">
                <Input
                  id="coupon-starts-at"
                  name="startsAt"
                  type="date"
                  value={form.startsAt}
                  onChange={(event) => patch({ startsAt: event.target.value })}
                  disabled={submitting}
                  invalid={Boolean(errors.startsAt)}
                />
                <Input
                  id="coupon-starts-time"
                  name="startsTime"
                  type="time"
                  value={form.startsTime}
                  onChange={(event) => patch({ startsTime: event.target.value })}
                  disabled={submitting}
                />
              </div>
            </FormField>
            <FormField id="coupon-ends-at" label="پایان" error={errors.endsAt} required>
              <div className="admin-coupon-form__datetime">
                <Input
                  id="coupon-ends-at"
                  name="endsAt"
                  type="date"
                  value={form.endsAt}
                  onChange={(event) => patch({ endsAt: event.target.value })}
                  disabled={submitting}
                  invalid={Boolean(errors.endsAt)}
                />
                <Input
                  id="coupon-ends-time"
                  name="endsTime"
                  type="time"
                  value={form.endsTime}
                  onChange={(event) => patch({ endsTime: event.target.value })}
                  disabled={submitting}
                />
              </div>
            </FormField>
            <FormField id="coupon-total-limit" label="سقف مصرف کل" optional error={errors.totalUsageLimit}>
              <Input
                id="coupon-total-limit"
                name="totalUsageLimit"
                value={form.totalUsageLimit ?? ""}
                onChange={(event) => patch({ totalUsageLimit: event.target.value })}
                disabled={submitting}
                inputMode="numeric"
              />
            </FormField>
            <FormField id="coupon-per-customer-limit" label="سقف هر مشتری" optional error={errors.perCustomerLimit}>
              <Input
                id="coupon-per-customer-limit"
                name="perCustomerLimit"
                value={form.perCustomerLimit ?? ""}
                onChange={(event) => patch({ perCustomerLimit: event.target.value })}
                disabled={submitting}
                inputMode="numeric"
              />
            </FormField>
          </div>
        </Card>

        <Card title="محدودیت‌ها">
          <div className="admin-coupon-form__grid">
            <FormField id="coupon-service-scope" label="دامنه خدمات">
              <Select
                id="coupon-service-scope"
                value={form.serviceScope}
                disabled={!restrictionsEditable || submitting}
                options={Object.entries(ADMIN_COUPON_SERVICE_SCOPE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(value) =>
                  patch({
                    serviceScope:
                      value === "include" ? "include" : value === "exclude" ? "exclude" : "all",
                    serviceIds: value === "all" ? [] : form.serviceIds,
                  })
                }
              />
            </FormField>
            {form.serviceScope !== "all" ? (
              <FormField id="coupon-services" label="خدمات" error={errors.serviceIds}>
                <MultiSelect
                  id="coupon-services"
                  values={form.serviceIds}
                  options={serviceOptions}
                  disabled={!restrictionsEditable || submitting}
                  onChange={(serviceIds) => patch({ serviceIds })}
                  placeholder="انتخاب خدمت"
                />
              </FormField>
            ) : null}
            {multiBranch && branchOptions.length ? (
              <FormField id="coupon-branches" label="شعب" error={errors.branchIds} optional>
                <MultiSelect
                  id="coupon-branches"
                  values={form.branchIds}
                  options={branchOptions}
                  disabled={!restrictionsEditable || submitting}
                  onChange={(branchIds) => patch({ branchIds })}
                  placeholder="همه شعب"
                />
              </FormField>
            ) : null}
          </div>
        </Card>

        {caps?.supportsDraft !== false ? (
          <Card title="وضعیت انتشار">
            <Switch
              label="ذخیره به‌صورت پیش‌نویس"
              checked={form.draft}
              onCheckedChange={(draft) => patch({ draft })}
              disabled={submitting}
            />
          </Card>
        ) : null}

        <Card title="خلاصه قوانین">
          <p className="admin-coupon-form__summary">{ruleSummary}</p>
        </Card>

        <div className="admin-coupon-form__actions">
          <Button type="submit" loading={submitting || impactLoading}>
            {mode === "create" ? "ایجاد کوپن" : "ذخیره تغییرات"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() =>
              requestLeave(
                mode === "edit" && reference
                  ? adminCouponDetailHref(reference)
                  : routes.admin.coupons,
              )
            }
          >
            انصراف
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={leaveOpen}
        title="تغییرات ذخیره نشده"
        description="با خروج، تغییرات از دست می‌رود."
        confirmLabel="خروج بدون ذخیره"
        cancelLabel="ماندن"
        onCancel={() => {
          setLeaveOpen(false);
          setPendingHref(undefined);
        }}
        onConfirm={() => router.push(pendingHref ?? routes.admin.coupons)}
      />

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید ویرایش"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                impact.existingBookingsUnchanged ? "رزروهای موجود بدون تغییر می‌مانند." : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.blocked ? "غیرفعال" : (impact?.confirmLabel ?? "ذخیره")}
        cancelLabel="انصراف"
        variant={impact?.blocked ? "destructive" : "primary"}
        busy={submitting}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          if (impact?.blocked) {
            setImpact(null);
            return;
          }
          void saveForm();
        }}
      />
    </>
  );
}
