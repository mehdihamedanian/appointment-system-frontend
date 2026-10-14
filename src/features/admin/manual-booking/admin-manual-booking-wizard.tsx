"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Stepper, type StepItem } from "@/components/ui/stepper";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { BranchStep } from "@/features/booking/steps/branch-step";
import { DateStep } from "@/features/booking/steps/date-step";
import { ServiceStep } from "@/features/booking/steps/service-step";
import { TimeStep } from "@/features/booking/steps/time-step";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { useEligibleProviders } from "@/features/providers/use-eligible-providers";
import { AdminManualBookingCustomerStep } from "@/features/admin/manual-booking/admin-customer-step";
import { AdminManualBookingSummary } from "@/features/admin/manual-booking/admin-manual-booking-summary";
import { AdminManualPaymentMethodList } from "@/features/admin/manual-booking/admin-manual-payment-methods";
import { AdminResourceAllocationStep } from "@/features/admin/manual-booking/admin-resource-allocation-step";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminBookableDatesQueryOptions,
  adminBookableSlotsQueryOptions,
  adminManualBookingOptionsQueryOptions,
  adminManualBookingQuoteQueryOptions,
  confirmAdminManualBooking,
  fetchAdminManualBookingQuote,
  fetchAdminResourceAllocation,
  fetchAdminServiceBranches,
} from "@/lib/api/admin-manual-booking";
import { isResourceConflictError } from "@/lib/admin/manual-booking-adapter";
import { startTimeFromSlotId } from "@/lib/api/backend-contract";
import {
  applyAllocationChange,
  applyBranchChange,
  applyCustomerChange,
  applyProviderChange,
  applyServiceChange,
  applySlotChange,
  applySlotTaken,
  applyDateChange,
  adminManualBookingIntentFingerprint,
  isBranchValidForService,
} from "@/lib/admin/manual-booking-draft";
import { invalidateAfterAdminManualBooking } from "@/lib/admin/manual-booking-cache";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { isQuoteChangedError, isQuoteExpired, isQuoteExpiredError } from "@/lib/booking/quote";
import { isSlotTakenError } from "@/lib/availability/slot-taken";
import {
  fetchPublicBusiness,
  fetchPublicServiceCatalog,
  fetchPublicServiceDetail,
} from "@/lib/api/public";
import {
  isForbiddenError,
  isNetworkUncertaintyError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { AppApiError } from "@/types/api";
import {
  ADMIN_MANUAL_BOOKING_STEP_LABELS,
  emptyAdminManualBookingDraft,
  type AdminManualBookingCustomerView,
  type AdminManualBookingDraft,
  type AdminManualBookingNotice,
  type AdminManualBookingStepId,
  type AdminManualBookingSuccessView,
} from "@/types/admin-manual-booking";

const STEP_ORDER: AdminManualBookingStepId[] = [
  "customer",
  "service",
  "provider",
  "datetime",
  "resources",
  "details",
  "review",
  "success",
];

const NOTICE_COPY: Record<AdminManualBookingNotice, string> = {
  slot_taken: "این زمان دیگر در دسترس نیست. لطفاً ساعت دیگری انتخاب کنید.",
  quote_changed: "استعلام قیمت تغییر کرد. لطفاً دوباره بررسی کنید.",
  quote_expired: "استعلام منقضی شده است. لطفاً دوباره استعلام بگیرید.",
  resource_conflict: "تخصیص منابع با تغییر دیگری در تضاد است.",
  confirm_uncertain: "نتیجه ثبت نامشخص است. وضعیت نوبت را در فهرست بررسی کنید.",
};

export function AdminManualBookingScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader
          title="ثبت نوبت دستی"
          description="ثبت نوبت برای مشتری توسط پذیرش."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.manualBooking}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "ثبت نوبت" },
              ]}
            />
          }
        />
        <Skeleton variant="card" />
      </>
    );
  }
  return (
    <PermissionGate permission="admin.appointments.create">
      <AdminManualBookingWizard userId={user.id} user={user} />
    </PermissionGate>
  );
}

function AdminManualBookingWizard({
  userId,
  user,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const confirmLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const seededFromUrl = useRef(false);
  const [currentStep, setCurrentStep] = useState<AdminManualBookingStepId>("customer");
  const [draft, setDraft] = useState<AdminManualBookingDraft>(() => emptyAdminManualBookingDraft());
  const [customer, setCustomer] = useState<AdminManualBookingCustomerView | null>(null);
  const [submittedStep, setSubmittedStep] = useState<AdminManualBookingStepId>();
  const [notice, setNotice] = useState<AdminManualBookingNotice>();
  const [confirmError, setConfirmError] = useState<AppApiError>();
  const [success, setSuccess] = useState<AdminManualBookingSuccessView>();
  const [quoteReceivedAt, setQuoteReceivedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const canViewResources = hasPermission(user, "admin.resources.view") || user.permissionCodes.length === 0;
  const canCreateCustomer =
    hasPermission(user, "admin.customers.create") || user.permissionCodes.length === 0;

  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const date = searchParams.get("date");
    const branch = searchParams.get("branch");
    const staff = searchParams.get("staff");
    setDraft((current) => {
      let next = current;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        next = applyDateChange(next, date);
      }
      if (branch) {
        next = applyBranchChange(next, branch);
      }
      if (staff) {
        next = applyProviderChange(next, { type: "specific", providerId: staff });
      }
      return next;
    });
  }, [searchParams]);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.services.list({}),
    queryFn: ({ signal }) => fetchPublicServiceCatalog(undefined, {}, signal),
  });

  const serviceQuery = useQuery({
    queryKey: queryKeys.services.detail(draft.serviceId ?? "_"),
    queryFn: ({ signal }) => fetchPublicServiceDetail(draft.serviceId!, undefined, signal),
    enabled: Boolean(draft.serviceId),
  });

  const branchesQuery = useQuery({
    queryKey: queryKeys.admin.manualBookingBranches(userId, draft.serviceId ?? "_"),
    queryFn: ({ signal }) => fetchAdminServiceBranches(draft.serviceId!, signal),
    enabled: Boolean(draft.serviceId),
    staleTime: 60_000,
    retry: false,
  });

  const providersQuery = useEligibleProviders({
    serviceId: draft.serviceId ?? undefined,
    branchId: draft.branchId ?? undefined,
    enabled: Boolean(draft.serviceId),
  });

  const optionsQuery = useQuery(adminManualBookingOptionsQueryOptions(userId));

  // Backend availability and `ManualBookingCreate` both require `branch_id`.
  const requiresBranch = businessQuery.data?.branchesEnabled !== false;
  const providerMode = providersQuery.data?.mode ?? "not_applicable";
  const branchIds = useMemo(() => (branchesQuery.data ?? []).map((item) => item.id), [branchesQuery.data]);

  if (draft.branchId && branchIds.length > 0 && !isBranchValidForService(draft.branchId, branchIds)) {
    setDraft((current) => applyBranchChange(current, null));
  }

  const quoteEnabled =
    currentStep === "details" ||
    currentStep === "review" ||
    (currentStep === "resources" && draft.allocationMode === "automatic");

  const quoteQuery = useQuery({
    ...adminManualBookingQuoteQueryOptions(userId, draft, quoteEnabled),
  });

  if (quoteQuery.data?.id && draft.quoteId !== quoteQuery.data.id) {
    setDraft((current) =>
      current.quoteId === quoteQuery.data?.id ? current : { ...current, quoteId: quoteQuery.data?.id },
    );
    setQuoteReceivedAt(quoteQuery.dataUpdatedAt || 0);
  }

  const allocationQuery = useQuery({
    queryKey: queryKeys.admin.manualBookingAllocation(userId, `${draft.serviceId}:${draft.branchId ?? ""}`),
    queryFn: ({ signal }) =>
      fetchAdminResourceAllocation({ serviceId: draft.serviceId, branchId: draft.branchId }, signal),
    enabled:
      currentStep === "resources" &&
      Boolean(draft.customerId && draft.serviceId && draft.slotId && draft.date),
    staleTime: 10_000,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedBranch = branchesQuery.data?.find((item) => item.id === draft.branchId);
  const bookingSources =
    quoteQuery.data?.bookingSources?.length
      ? quoteQuery.data.bookingSources
      : optionsQuery.data?.bookingSources ?? [];

  const steps: StepItem[] = STEP_ORDER.filter((step) => step !== "success").map((step) => {
    const index = STEP_ORDER.indexOf(step);
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    let state: StepItem["state"] = "upcoming";
    if (step === currentStep) state = "current";
    else if (index < currentIndex || currentStep === "success") state = "complete";
    return { id: step, label: ADMIN_MANUAL_BOOKING_STEP_LABELS[step], state };
  });

  const patchDraft = useCallback((updater: (current: AdminManualBookingDraft) => AdminManualBookingDraft) => {
    setDraft(updater);
    setConfirmError(undefined);
  }, []);

  function goTo(step: AdminManualBookingStepId) {
    setCurrentStep(step);
    setSubmittedStep(undefined);
    setConfirmError(undefined);
  }

  function validateStep(step: AdminManualBookingStepId): boolean {
    setSubmittedStep(step);
    switch (step) {
      case "customer":
        return Boolean(customer?.id);
      case "service":
        if (!draft.serviceId) return false;
        if (requiresBranch && !draft.branchId) return false;
        return true;
      case "provider":
        if (providerMode === "required" && draft.providerPreference.type !== "specific") return false;
        return true;
      case "datetime":
        return Boolean(draft.date && draft.slotId);
      case "resources":
        if (
          draft.allocationMode !== "automatic" &&
          canViewResources &&
          (allocationQuery.data?.groups.length ?? 0) > 0
        ) {
          return Object.values(draft.resourceSelections).some((ids) => ids.length > 0);
        }
        return true;
      case "details":
        if (!draft.paymentMethod && (quoteQuery.data?.paymentOptions.length ?? 0) > 0) return false;
        if (bookingSources.length > 0 && !draft.bookingSource) return false;
        return true;
      case "review":
        return Boolean(quoteQuery.data && !isQuoteExpired(quoteQuery.data, quoteReceivedAt, now));
      default:
        return true;
    }
  }

  function nextStep() {
    const index = STEP_ORDER.indexOf(currentStep);
    if (!validateStep(currentStep)) return;
    if (index < STEP_ORDER.length - 2) {
      goTo(STEP_ORDER[index + 1]!);
    }
  }

  function prevStep() {
    const index = STEP_ORDER.indexOf(currentStep);
    if (index > 0) goTo(STEP_ORDER[index - 1]!);
  }

  function idempotencyKeyForIntent() {
    const fingerprint = adminManualBookingIntentFingerprint(draft, draft.quoteId);
    if (!idempotencyRef.current || idempotencyRef.current.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: createIdempotencyKey() };
    }
    return idempotencyRef.current.key;
  }

  async function onConfirm() {
    if (confirmLock.current || submitting) return;
    if (!validateStep("review")) return;
    confirmLock.current = true;
    setSubmitting(true);
    setConfirmError(undefined);
    setNotice(undefined);
    try {
      let quote = quoteQuery.data;
      if (!quote || isQuoteExpired(quote, quoteReceivedAt, Date.now())) {
        quote = await fetchAdminManualBookingQuote();
        setQuoteReceivedAt(Date.now());
        if (quote.changed) {
          setNotice("quote_changed");
          goTo("details");
          return;
        }
      }
      const draftForConfirm = { ...draft, quoteId: quote.id ?? draft.quoteId };
      const result = await confirmAdminManualBooking(draftForConfirm, idempotencyKeyForIntent());
      if (result.outcome === "missing_endpoint") {
        setConfirmError({
          status: 404,
          message: "ثبت نوبت دستی هنوز به سرویس متصل نشده است.",
        });
        return;
      }
      if (result.outcome === "quote_changed") {
        setNotice("quote_changed");
        if (result.quote) {
          queryClient.setQueryData(
            queryKeys.admin.manualBookingQuote(userId, adminManualBookingIntentFingerprint(draftForConfirm)),
            result.quote,
          );
        }
        goTo("details");
        return;
      }
      if (!result.reference) {
        setConfirmError({ status: 422, message: "پاسخ ثبت بدون مرجع نوبت بود." });
        return;
      }
      invalidateAfterAdminManualBooking(queryClient, userId, result.reference);
      const startsAt = quote.slot?.startsAt ?? startTimeFromSlotId(draft.slotId);
      const parts = startsAt
        ? formatAppointmentParts(startsAt, quote.timezone ?? businessQuery.data?.timezone)
        : undefined;
      setSuccess({
        reference: result.reference,
        customerName: customer?.displayName ?? "—",
        serviceName: quote.service?.name ?? serviceQuery.data?.name ?? "—",
        providerName: quote.provider?.name,
        branchName: quote.branch?.name ?? selectedBranch?.name,
        startsAtLabel: quote.slot?.label ?? parts?.label ?? draft.date ?? "—",
        paymentStatusLabel: result.paymentStatusLabel,
        allocationSummary: result.allocationSummary ?? allocationQuery.data?.automaticSummary,
      });
      goTo("success");
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isSessionExpiredError(normalized)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isSlotTakenError(normalized)) {
        setNotice("slot_taken");
        patchDraft((current) => applySlotTaken(current));
        goTo("datetime");
        return;
      }
      if (isQuoteChangedError(normalized)) {
        setNotice("quote_changed");
        goTo("details");
        return;
      }
      if (isQuoteExpiredError(normalized)) {
        setNotice("quote_expired");
        goTo("details");
        return;
      }
      if (isResourceConflictError(normalized)) {
        setNotice("resource_conflict");
        patchDraft((current) =>
          applyAllocationChange(current, { allocationMode: "automatic", resourceSelections: {} }),
        );
        goTo("resources");
        return;
      }
      if (isForbiddenError(normalized)) {
        setConfirmError({ status: 403, message: "مجوز ثبت این نوبت را ندارید." });
        return;
      }
      if (isNetworkUncertaintyError(normalized)) {
        setNotice("confirm_uncertain");
      }
      if (isValidationError(normalized)) {
        setConfirmError(normalized);
        return;
      }
      setConfirmError(normalized);
    } finally {
      confirmLock.current = false;
      setSubmitting(false);
    }
  }

  if (currentStep === "success" && success) {
    return (
      <>
        <AdminPageHeader
          title="نوبت ثبت شد"
          description="نوبت با موفقیت در سامانه ثبت شد."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.manualBooking}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "ثبت نوبت" },
              ]}
            />
          }
        />
        <section className="admin-manual-booking-success" aria-labelledby="success-title">
          <Alert tone="success" title="نوبت با موفقیت ثبت شد" />
          <h2 id="success-title" className="text-card-title">
            {success.reference}
          </h2>
          <dl className="booking-summary">
            <div><dt>مشتری</dt><dd>{success.customerName}</dd></div>
            <div><dt>خدمت</dt><dd>{success.serviceName}</dd></div>
            {success.providerName ? <div><dt>متخصص</dt><dd>{success.providerName}</dd></div> : null}
            {success.branchName ? <div><dt>شعبه</dt><dd>{success.branchName}</dd></div> : null}
            <div><dt>زمان</dt><dd className="ltr-value">{success.startsAtLabel}</dd></div>
            {success.paymentStatusLabel ? (
              <div><dt>وضعیت پرداخت</dt><dd>{success.paymentStatusLabel}</dd></div>
            ) : null}
            {success.allocationSummary && canViewResources ? (
              <div><dt>منابع</dt><dd>{success.allocationSummary}</dd></div>
            ) : null}
          </dl>
          <div className="booking-wizard__nav">
            <Button asChild>
              <Link href={routes.admin.appointmentDetail(success.reference)}>مشاهده نوبت</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(emptyAdminManualBookingDraft());
                setCustomer(null);
                setSuccess(undefined);
                idempotencyRef.current = undefined;
                goTo("customer");
              }}
            >
              ثبت نوبت دیگر
            </Button>
            <Button asChild variant="ghost">
              <Link href={routes.admin.calendar}>تقویم</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={routes.admin.appointments}>فهرست نوبت‌ها</Link>
            </Button>
          </div>
        </section>
      </>
    );
  }

  const buildDatesQueryOptions = (month: string) =>
    adminBookableDatesQueryOptions(
      draft.customerId!,
      draft.serviceId!,
      draft.branchId ?? undefined,
      draft.providerPreference,
      month,
      { requiresBranch, providerMode },
    );

  const buildSlotsQueryOptions = (date: string) =>
    adminBookableSlotsQueryOptions(
      draft.customerId!,
      draft.serviceId!,
      draft.branchId ?? undefined,
      draft.providerPreference,
      date,
      { requiresBranch, providerMode },
    );

  return (
    <>
      <AdminPageHeader
        title="ثبت نوبت دستی"
        description="ثبت نوبت برای مشتری توسط پذیرش — تمام زمان‌ها و قیمت‌ها از سرویس دریافت می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.manualBooking}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "ثبت نوبت" },
            ]}
          />
        }
      />
      <div className="booking-wizard admin-manual-booking-wizard">
        {notice ? (
          <Alert
            tone={notice === "slot_taken" || notice === "resource_conflict" ? "error" : "warning"}
            title={NOTICE_COPY[notice]}
            dismissible
            onDismiss={() => setNotice(undefined)}
          />
        ) : null}
        {confirmError ? (
          <Alert
            tone="error"
            title={confirmError.fieldErrors ? "برخی اطلاعات نیاز به اصلاح دارند" : "ثبت نوبت انجام نشد"}
            description={confirmError.message}
          />
        ) : null}
        <Stepper
          steps={steps}
          orientation="horizontal"
          onStepSelect={(id) => {
            const target = id as AdminManualBookingStepId;
            const targetIndex = STEP_ORDER.indexOf(target);
            const currentIndex = STEP_ORDER.indexOf(currentStep);
            if (targetIndex <= currentIndex) goTo(target);
          }}
        />
        <div className="booking-wizard__layout">
          <div className="booking-wizard__main">
            {currentStep === "customer" ? (
              <AdminManualBookingCustomerStep
                userId={userId}
                user={user}
                selected={customer}
                canCreateCustomer={canCreateCustomer}
                submitted={submittedStep === "customer"}
                onSelect={(next) => {
                  setCustomer(next);
                  patchDraft((current) => applyCustomerChange(current, next?.id ?? null));
                }}
              />
            ) : null}
            {currentStep === "service" ? (
              <>
                <ServiceStep
                  services={catalogQuery.data?.items ?? []}
                  selectedId={draft.serviceId}
                  loading={catalogQuery.isPending}
                  error={catalogQuery.isError ? toAppApiError(catalogQuery.error) : undefined}
                  onRetry={() => void catalogQuery.refetch()}
                  submitted={submittedStep === "service"}
                  onSelect={(serviceId) =>
                    patchDraft((current) => {
                      const next = applyServiceChange(current, serviceId);
                      const urlBranch = searchParams.get("branch");
                      return urlBranch && !next.branchId ? applyBranchChange(next, urlBranch) : next;
                    })
                  }
                />
                {requiresBranch && draft.serviceId ? (
                  <BranchStep
                    branches={branchesQuery.data ?? []}
                    selectedId={draft.branchId}
                    loading={branchesQuery.isPending}
                    error={branchesQuery.isError ? toAppApiError(branchesQuery.error) : undefined}
                    onRetry={() => void branchesQuery.refetch()}
                    submitted={submittedStep === "service"}
                    onSelect={(branchId) => patchDraft((current) => applyBranchChange(current, branchId))}
                  />
                ) : null}
              </>
            ) : null}
            {currentStep === "provider" ? (
              <ProviderSelectionField
                serviceId={draft.serviceId ?? undefined}
                branchId={draft.branchId ?? undefined}
                value={draft.providerPreference}
                submitted={submittedStep === "provider"}
                onChange={(preference) =>
                  patchDraft((current) =>
                    applyProviderChange(current, preference ?? { type: "not_applicable" }),
                  )
                }
              />
            ) : null}
            {currentStep === "datetime" ? (
              <>
                <DateStep
                  serviceId={draft.serviceId}
                  branchId={draft.branchId}
                  preference={draft.providerPreference}
                  requiresBranch={requiresBranch}
                  providerMode={providerMode}
                  selected={draft.date}
                  timezone={businessQuery.data?.timezone}
                  submitted={submittedStep === "datetime"}
                  buildDatesQueryOptions={draft.customerId && draft.serviceId ? buildDatesQueryOptions : undefined}
                  onSelect={(date) => patchDraft((current) => applyDateChange(current, date))}
                />
                <TimeStep
                  serviceId={draft.serviceId}
                  branchId={draft.branchId}
                  preference={draft.providerPreference}
                  requiresBranch={requiresBranch}
                  providerMode={providerMode}
                  date={draft.date}
                  selectedId={draft.slotId}
                  timezone={businessQuery.data?.timezone}
                  submitted={submittedStep === "datetime"}
                  showWaitingListActions={false}
                  buildSlotsQueryOptions={draft.customerId && draft.serviceId ? buildSlotsQueryOptions : undefined}
                  onSelect={(slotId) => patchDraft((current) => applySlotChange(current, slotId))}
                  onPickAnotherDate={() => patchDraft((current) => applyDateChange(current, null))}
                  onBackToProvider={() => goTo("provider")}
                  onBackToBranch={() => goTo("service")}
                />
              </>
            ) : null}
            {currentStep === "resources" ? (
              <AdminResourceAllocationStep
                allocation={allocationQuery.data ?? quoteQuery.data?.allocation}
                loading={allocationQuery.isPending}
                error={
                  allocationQuery.isError
                    ? toAppApiError(allocationQuery.error)
                    : undefined
                }
                onRetry={() => void allocationQuery.refetch()}
                mode={draft.allocationMode}
                selections={draft.resourceSelections}
                canViewResources={canViewResources}
                submitted={submittedStep === "resources"}
                onModeChange={(mode) =>
                  patchDraft((current) =>
                    applyAllocationChange(current, {
                      allocationMode: mode,
                      resourceSelections: mode === "automatic" ? {} : current.resourceSelections,
                    }),
                  )
                }
                onSelectionChange={(groupId, resourceIds) =>
                  patchDraft((current) =>
                    applyAllocationChange(current, {
                      allocationMode: current.allocationMode,
                      resourceSelections: { ...current.resourceSelections, [groupId]: resourceIds },
                    }),
                  )
                }
              />
            ) : null}
            {currentStep === "details" ? (
              <section className="admin-manual-booking-details" aria-labelledby="details-title">
                <h2 id="details-title" className="text-card-title">
                  پرداخت، منبع ثبت و یادداشت
                </h2>
                {quoteQuery.isPending ? <InlineLoading label="در حال دریافت استعلام" /> : null}
                {quoteQuery.isError ? (
                  <ApiErrorState
                    title="استعلام قیمت دریافت نشد"
                    description={toAppApiError(quoteQuery.error).message}
                    onRetry={() => void quoteQuery.refetch()}
                  />
                ) : null}
                {quoteQuery.data?.pricedAtBooking ? (
                  <p className="ds-help">
                    مبلغ و وضعیت پرداخت را سرویس نوبت‌دهی هنگام ثبت نوبت تعیین می‌کند.
                  </p>
                ) : null}
                {quoteQuery.data ? (
                  <>
                    <dl className="booking-summary">
                      {quoteQuery.data.finalAmountLabel ? (
                        <div>
                          <dt>مبلغ نهایی</dt>
                          <dd className="ltr-value booking-money">{quoteQuery.data.finalAmountLabel}</dd>
                        </div>
                      ) : null}
                      {quoteQuery.data.depositLabel ? (
                        <div>
                          <dt>بیعانه</dt>
                          <dd className="ltr-value booking-money">{quoteQuery.data.depositLabel}</dd>
                        </div>
                      ) : null}
                      {quoteQuery.data.discountLabel ? (
                        <div>
                          <dt>تخفیف</dt>
                          <dd className="ltr-value booking-money">{quoteQuery.data.discountLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <AdminManualPaymentMethodList
                      options={quoteQuery.data.paymentOptions}
                      selected={draft.paymentMethod}
                      onSelect={(paymentMethod) => patchDraft((current) => ({ ...current, paymentMethod }))}
                    />
                  </>
                ) : null}
                {bookingSources.length > 0 ? (
                  <FormField
                    id="bookingSource"
                    label="منبع ثبت"
                    required
                    error={submittedStep === "details" && !draft.bookingSource ? "منبع ثبت را انتخاب کنید." : undefined}
                  >
                    <Select
                      id="bookingSource"
                      value={draft.bookingSource ?? ""}
                      onChange={(value) =>
                        patchDraft((current) => ({ ...current, bookingSource: value ?? "" }))
                      }
                      options={bookingSources.map((source) => ({
                        value: source.value,
                        label: source.label,
                      }))}
                    />
                  </FormField>
                ) : null}
                <FormField id="customerNote" label="یادداشت مشتری">
                  <Textarea
                    id="customerNote"
                    value={draft.customerNote ?? ""}
                    onChange={(event) =>
                      patchDraft((current) => ({ ...current, customerNote: event.target.value }))
                    }
                    rows={3}
                  />
                </FormField>
                <FormField
                  id="internalNote"
                  label="یادداشت داخلی"
                  description="این یادداشت برای مشتری نمایش داده نمی‌شود و در اعلان‌ها ارسال نمی‌گردد."
                >
                  <Textarea
                    id="internalNote"
                    value={draft.internalNote ?? ""}
                    onChange={(event) =>
                      patchDraft((current) => ({ ...current, internalNote: event.target.value }))
                    }
                    rows={3}
                  />
                </FormField>
              </section>
            ) : null}
            {currentStep === "review" ? (
              <section aria-labelledby="review-title">
                <h2 id="review-title" className="text-card-title">
                  بررسی و تأیید
                </h2>
                {quoteQuery.data && isQuoteExpired(quoteQuery.data, quoteReceivedAt, now) ? (
                  <Alert
                    tone="warning"
                    title="استعلام منقضی شده"
                    description="قبل از ثبت، استعلام را دوباره دریافت کنید."
                  />
                ) : null}
                <AdminManualBookingSummary
                  customer={customer}
                  service={serviceQuery.data ?? catalogQuery.data?.items.find((item) => item.id === draft.serviceId)}
                  branch={selectedBranch}
                  eligible={providersQuery.data}
                  draft={draft}
                  quote={quoteQuery.data}
                  timezone={businessQuery.data?.timezone}
                />
                {draft.internalNote ? (
                  <p className="ds-help">
                    یادداشت داخلی: {draft.internalNote} (فقط برای کارکنان)
                  </p>
                ) : null}
                {draft.customerNote ? (
                  <p className="ds-help">یادداشت مشتری: {draft.customerNote}</p>
                ) : null}
                {quoteQuery.data?.policySnapshot?.summary ? (
                  <p className="ds-help">{quoteQuery.data.policySnapshot.summary}</p>
                ) : null}
              </section>
            ) : null}
            <div className="booking-wizard__nav">
              {currentStep !== "customer" ? (
                <Button variant="ghost" onClick={prevStep}>
                  مرحله قبل
                </Button>
              ) : null}
              {currentStep !== "review" ? (
                <Button onClick={nextStep}>مرحله بعد</Button>
              ) : (
                <Button onClick={() => void onConfirm()} loading={submitting}>
                  ثبت نوبت
                </Button>
              )}
            </div>
          </div>
          <div className="booking-wizard__aside">
            <AdminManualBookingSummary
              customer={customer}
              service={serviceQuery.data ?? catalogQuery.data?.items.find((item) => item.id === draft.serviceId)}
              branch={selectedBranch}
              eligible={providersQuery.data}
              draft={draft}
              quote={quoteQuery.data}
              quoteLoading={quoteQuery.isFetching}
              timezone={businessQuery.data?.timezone}
            />
          </div>
        </div>
      </div>
    </>
  );
}
