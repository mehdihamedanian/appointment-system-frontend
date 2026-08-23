"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Stepper, type StepItem } from "@/components/ui/stepper";
import { PageHeader } from "@/components/layout/page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { ServiceStep } from "@/features/booking/steps/service-step";
import { BranchStep } from "@/features/booking/steps/branch-step";
import { DateStep } from "@/features/booking/steps/date-step";
import { TimeStep } from "@/features/booking/steps/time-step";
import { DetailsStep } from "@/features/booking/steps/details-step";
import { SummaryStep, canSubmitQuote } from "@/features/booking/steps/summary-step";
import { CheckoutStep } from "@/features/booking/steps/checkout-step";
import { useBookingWizard } from "@/features/booking/use-booking-wizard";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { useEligibleProviders } from "@/features/providers/use-eligible-providers";
import { useSession } from "@/features/auth/session-provider";
import {
  confirmBooking,
  fetchBookingQuote,
  previewBookingCheckout,
} from "@/lib/api/booking";
import { createSlotHold } from "@/lib/api/hold";
import { invalidateAfterBookingResult } from "@/lib/booking/confirmation-cache";
import { requiresSlotHold } from "@/lib/booking/hold-adapter";
import { writeHoldReference } from "@/lib/booking/hold-session";
import {
  fetchPublicBusiness,
  fetchPublicServiceCatalog,
  fetchPublicServiceDetail,
  fetchServiceBranches,
} from "@/lib/api/public";
import {
  isNetworkUncertaintyError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { isSlotTakenError } from "@/lib/availability/slot-taken";
import { preferenceKey } from "@/lib/availability/context";
import { BOOKING_NOTICE_COPY } from "@/lib/booking/notices";
import { createIdempotencyKey, quoteIntentFingerprint } from "@/lib/booking/idempotency";
import { isPolicyChangedError, isQuoteChangedError, isQuoteExpired, isQuoteExpiredError } from "@/lib/booking/quote";
import { isBookingStepId } from "@/lib/booking/steps";
import { reduceWizardStatus } from "@/lib/booking/machine";
import { queryKeys } from "@/lib/query/keys";
import { isBookableService } from "@/lib/public/service-adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";
import type { AppApiError } from "@/types/api";
import {
  BOOKING_STEP_LABELS,
  type BookingStepId,
} from "@/types/booking";

export function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmLock = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const lastStepParam = useRef(searchParams.get("step"));
  const urlService = searchParams.get("service");
  const [serviceId, setServiceId] = useState<string | null>(urlService);
  const [branchId, setBranchId] = useState<string | null>(searchParams.get("branch"));
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [confirmError, setConfirmError] = useState<AppApiError>();
  const [seenQuoteIdentity, setSeenQuoteIdentity] = useState("");
  const [seenQuoteChangeStamp, setSeenQuoteChangeStamp] = useState("");
  const [now, setNow] = useState(0);

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
    queryKey: queryKeys.services.detail(serviceId ?? "_"),
    queryFn: ({ signal }) => fetchPublicServiceDetail(serviceId!, undefined, signal),
    enabled: Boolean(serviceId),
  });

  const branchesQuery = useQuery({
    queryKey: queryKeys.services.branches(serviceId ?? "_"),
    queryFn: ({ signal }) => fetchServiceBranches(serviceId!, signal),
    enabled: Boolean(serviceId) && Boolean(businessQuery.data?.branchesEnabled),
  });

  const providersQuery = useEligibleProviders({
    serviceId: serviceId ?? undefined,
    branchId: branchId ?? undefined,
    enabled: Boolean(serviceId),
  });

  const composition = useMemo(
    () => ({
      branchesEnabled: businessQuery.data?.branchesEnabled === true,
      eligibleBranchCount: branchesQuery.data?.length ?? 0,
      branchesResolved:
        businessQuery.data?.branchesEnabled !== true || branchesQuery.isFetched,
      providerMode: providersQuery.data?.mode ?? "not_applicable",
      providersResolved: !serviceId || providersQuery.isFetched || providersQuery.fetchStatus === "idle",
      additionalFieldCount: serviceQuery.data?.additionalFields.length ?? 0,
      fieldsResolved: !serviceId || serviceQuery.isFetched,
    }),
    [
      businessQuery.data?.branchesEnabled,
      branchesQuery.data?.length,
      branchesQuery.isFetched,
      providersQuery.data?.mode,
      providersQuery.fetchStatus,
      providersQuery.isFetched,
      serviceId,
      serviceQuery.data?.additionalFields.length,
      serviceQuery.isFetched,
    ],
  );

  const wizard = useBookingWizard({
    composition,
    additionalFields: serviceQuery.data?.additionalFields ?? [],
    eligible: providersQuery.data,
    urlService,
    urlBranch: searchParams.get("branch"),
    urlProvider: searchParams.get("provider"),
  });

  if (wizard.draft.serviceId !== serviceId) {
    setServiceId(wizard.draft.serviceId);
  }
  if (wizard.draft.branchId !== branchId) {
    setBranchId(wizard.draft.branchId);
  }

  const {
    goTo,
    goNext,
    applyProviderMode,
    chooseBranch,
    chooseService,
    setNotice,
    currentStep,
    submitted,
    steps,
    quoteReviewed,
    draft,
  } = wizard;

  const quoteEnabled =
    (wizard.currentStep === "summary" || wizard.currentStep === "checkout") &&
    Boolean(wizard.draft.serviceId && wizard.draft.date && wizard.draft.slotId);
  const quoteFingerprint = quoteIntentFingerprint(wizard.draft);
  const quoteQuery = useQuery({
    queryKey: queryKeys.booking.quote(quoteFingerprint),
    queryFn: ({ signal }) => fetchBookingQuote(wizard.draft, signal),
    enabled: quoteEnabled,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const quoteIdentity = `${quoteQuery.data?.id ?? ""}:${quoteQuery.data?.policyChanged ? "1" : "0"}`;
  if (quoteIdentity !== seenQuoteIdentity) {
    setSeenQuoteIdentity(quoteIdentity);
    if (policyAccepted) {
      setPolicyAccepted(false);
    }
  }

  useEffect(() => {
    headingRef.current?.focus();
  }, [wizard.currentStep]);

  useEffect(() => {
    if (!quoteQuery.data?.expiresAt) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [quoteQuery.data?.expiresAt]);

  useEffect(() => {
    if (
      wizard.notice === "slot_taken" ||
      wizard.notice === "quote_changed" ||
      wizard.notice === "quote_expired" ||
      wizard.notice === "policy_changed" ||
      wizard.notice === "confirm_uncertain" ||
      wizard.notice === "hold_expired" ||
      wizard.notice === "hold_invalid" ||
      wizard.notice === "hold_released"
    ) {
      noticeRef.current?.focus();
    }
  }, [wizard.notice]);

  const availabilityContextKey = [
    wizard.draft.serviceId,
    wizard.draft.branchId,
    preferenceKey(wizard.draft.providerPreference),
  ].join(":");
  const lastAvailabilityContext = useRef(availabilityContextKey);

  useEffect(() => {
    if (lastAvailabilityContext.current === availabilityContextKey) {
      return;
    }
    lastAvailabilityContext.current = availabilityContextKey;
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  }, [availabilityContextKey, queryClient]);

  useEffect(() => {
    if (
      !draft.date &&
      (currentStep === "time" ||
        currentStep === "details" ||
        currentStep === "summary" ||
        currentStep === "checkout")
    ) {
      goTo("date", { force: true });
    }
  }, [currentStep, draft.date, goTo]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (draft.serviceId) {
      params.set("service", draft.serviceId);
    }
    if (draft.branchId) {
      params.set("branch", draft.branchId);
    }
    params.set("step", currentStep);
    const next = params.toString();
    const current = new URLSearchParams(searchParams.toString());
    current.delete("provider");
    if (next !== current.toString()) {
      router.replace(`${routes.customer.booking}?${next}`, { scroll: false });
    }
  }, [router, searchParams, currentStep, draft.branchId, draft.serviceId]);

  useEffect(() => {
    const step = searchParams.get("step");
    if (step !== lastStepParam.current) {
      lastStepParam.current = step;
      if (isBookingStepId(step)) {
        goTo(step);
      }
    }
  }, [goTo, searchParams]);

  useEffect(() => {
    if (providersQuery.data) {
      applyProviderMode(providersQuery.data);
    }
  }, [applyProviderMode, providersQuery.data]);

  useEffect(() => {
    const only = branchesQuery.data?.length === 1 ? branchesQuery.data[0] : undefined;
    if (only && draft.branchId !== only.id) {
      chooseBranch(only.id);
    }
  }, [branchesQuery.data, chooseBranch, draft.branchId]);

  useEffect(() => {
    if (
      draft.branchId &&
      branchesQuery.isFetched &&
      branchesQuery.data &&
      !branchesQuery.data.some((item) => item.id === draft.branchId)
    ) {
      setNotice("branch_unavailable");
      chooseBranch(null);
      goTo(steps.includes("branch") ? "branch" : "service", { force: true });
    }
  }, [
    branchesQuery.data,
    branchesQuery.isFetched,
    chooseBranch,
    draft.branchId,
    goTo,
    setNotice,
    steps,
  ]);

  useEffect(() => {
    if (serviceQuery.data && !isBookableService(serviceQuery.data)) {
      setNotice("service_unavailable");
      chooseService(null);
    }
  }, [chooseService, serviceQuery.data, setNotice]);

  const quoteStamp = `${quoteFingerprint}:${quoteQuery.data?.id ?? ""}:${quoteQuery.data?.changed ? "1" : "0"}`;
  if (quoteQuery.data?.changed && quoteStamp !== seenQuoteChangeStamp) {
    setSeenQuoteChangeStamp(quoteStamp);
    if (quoteReviewed) {
      wizard.setQuoteReviewed(false);
    }
  }

  useEffect(() => {
    if (currentStep === "service" && submitted && steps.length > 1) {
      goNext();
    }
  }, [currentStep, goNext, steps.length, submitted]);

  const stepperItems: StepItem[] = wizard.steps.map((id) => ({
    id,
    label: BOOKING_STEP_LABELS[id],
    state:
      id === wizard.currentStep
        ? "current"
        : wizard.stepValid(id) &&
            wizard.steps.indexOf(id) < wizard.steps.indexOf(wizard.currentStep)
          ? "complete"
          : "upcoming",
  }));

  const quoteClock = now || quoteQuery.dataUpdatedAt;
  const quoteExpired = quoteQuery.data
    ? isQuoteExpired(quoteQuery.data, quoteQuery.dataUpdatedAt, quoteClock)
    : false;
  const quoteReady = canSubmitQuote(quoteQuery.data, {
    quoteReviewed: wizard.quoteReviewed,
    policyAccepted,
    expired: quoteExpired,
  });

  function invalidateQuoteCache() {
    void queryClient.removeQueries({ queryKey: ["booking", "quote"] });
  }

  function editStep(step: BookingStepId) {
    invalidateQuoteCache();
    wizard.goTo(step, { force: true });
  }

  function idempotencyKeyForIntent() {
    const fingerprint = quoteIntentFingerprint(wizard.draft, quoteQuery.data?.id);
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: createIdempotencyKey() };
    }
    return idempotencyRef.current.key;
  }

  function handleSlotTakenConflict() {
    wizard.markSlotTaken();
    invalidateQuoteCache();
    void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  }

  async function completeBookingSuccess(reference?: string) {
    if (!reference || !isSafePublicId(reference)) {
      setConfirmError({
        status: 0,
        message: "پاسخ تأیید مرجع نوبت نداشت. موفقیت گزارش نشد.",
      });
      wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
      return;
    }
    wizard.finishSuccess(reference);
    invalidateAfterBookingResult(queryClient, user?.id);
    router.push(routes.customer.bookingConfirmation(reference));
  }

  async function onContinue() {
    if (wizard.currentStep !== "checkout") {
      if (wizard.currentStep === "summary") {
        if (!quoteReady) {
          return;
        }
        wizard.setQuoteReviewed(true);
      }
      wizard.goNext();
      return;
    }
    if (!quoteReady || confirmLock.current || wizard.status === "submitting") {
      return;
    }
    confirmLock.current = true;
    setConfirmError(undefined);
    wizard.setStatus((status) => reduceWizardStatus(status, "submit-start"));
    const draftForConfirm = { ...wizard.draft, quoteId: quoteQuery.data?.id };
    try {
      const preview = await previewBookingCheckout(draftForConfirm);
      if (preview.quote?.policyChanged) {
        wizard.setNotice("policy_changed");
        wizard.setQuoteReviewed(false);
        setPolicyAccepted(false);
        wizard.goTo("summary", { force: true });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (preview.quote?.changed) {
        wizard.markQuoteChanged(preview.quote.id);
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (preview.quote && isQuoteExpired(preview.quote, Date.now())) {
        wizard.setNotice("quote_expired");
        wizard.goTo("summary", { force: true });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (preview.checkoutPath === "unknown" && preview.quote?.paymentMode === "unknown") {
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      const quoteForPath = preview.quote ?? quoteQuery.data;
      if (
        quoteForPath?.paymentMode === "pay_at_location" ||
        preview.checkoutPath === "pay_at_location"
      ) {
        wizard.setStatus((status) => reduceWizardStatus(status, "redirect"));
        router.push(routes.customer.bookingPayment);
        return;
      }
      if (
        requiresSlotHold(quoteForPath) ||
        preview.checkoutPath === "pay_full" ||
        preview.checkoutPath === "pay_deposit"
      ) {
        const holdResult = await createSlotHold(draftForConfirm, idempotencyKeyForIntent());
        if (holdResult.outcome === "missing_endpoint") {
          setConfirmError({
            status: 404,
            message: "رزرو موقت هنوز به سرویس متصل نشده است. زمان نگه داشته نشد.",
          });
          wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
          return;
        }
        if (holdResult.outcome === "missing_expires_at") {
          setConfirmError({
            status: 422,
            code: "HOLD_MISSING_EXPIRES_AT",
            message: "پاسخ رزرو موقت بدون زمان انقضا بود. شمارنده شروع نشد.",
          });
          wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
          return;
        }
        const holdReference = holdResult.hold.publicReference ?? holdResult.hold.holdId;
        writeHoldReference(holdReference);
        queryClient.setQueryData(queryKeys.booking.hold(holdReference), holdResult.hold);
        wizard.setStatus((status) => reduceWizardStatus(status, "redirect"));
        router.push(routes.customer.bookingHold(holdReference));
        return;
      }
      const result = await confirmBooking(draftForConfirm, idempotencyKeyForIntent());
      if (result.outcome === "quote_changed") {
        wizard.markQuoteChanged(result.quote?.id);
        if (result.quote) {
          queryClient.setQueryData(queryKeys.booking.quote(quoteFingerprint), result.quote);
        }
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (result.outcome === "missing_endpoint") {
        setConfirmError({
          status: 404,
          message: "ثبت نوبت هنوز به سرویس متصل نشده است. نوبت ساخته نشد.",
        });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      const reference = result.reference ?? result.bookingId;
      if (result.outcome === "confirmed" && !reference) {
        setConfirmError({
          status: 0,
          message: "پاسخ تأیید مرجع نوبت نداشت. موفقیت گزارش نشد.",
        });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (result.outcome === "payment_required" || result.outcome === "held") {
        if (reference) {
          await completeBookingSuccess(reference);
          return;
        }
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        setConfirmError({
          status: 200,
          message: "پرداخت لازم است اما رزرو موقت از سرویس دریافت نشد. نوبت به‌عنوان موفق ثبت نشد.",
        });
        return;
      }
      await completeBookingSuccess(reference);
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isSessionExpiredError(normalized)) {
        wizard.expire();
        return;
      }
      if (isQuoteExpiredError(normalized)) {
        wizard.setNotice("quote_expired");
        wizard.goTo("summary", { force: true });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (isPolicyChangedError(normalized)) {
        wizard.setNotice("policy_changed");
        setPolicyAccepted(false);
        wizard.goTo("summary", { force: true });
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (isQuoteChangedError(normalized)) {
        wizard.markQuoteChanged(quoteQuery.data?.id);
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (isSlotTakenError(normalized)) {
        handleSlotTakenConflict();
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (isNetworkUncertaintyError(normalized)) {
        wizard.setNotice("confirm_uncertain");
        setConfirmError(normalized);
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      if (isValidationError(normalized)) {
        setConfirmError(normalized);
        wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
        return;
      }
      setConfirmError(normalized);
      wizard.setStatus((status) => reduceWizardStatus(status, "fail"));
    } finally {
      confirmLock.current = false;
    }
  }

  useEffect(() => {
    if (confirmError) {
      errorRef.current?.focus();
    }
  }, [confirmError]);

  const currentLabel = BOOKING_STEP_LABELS[wizard.currentStep];
  const submitting = wizard.status === "submitting";
  const selectedBranch = branchesQuery.data?.find((item) => item.id === wizard.draft.branchId);

  return (
    <div className="booking-wizard">
      <PageHeader title="رزرو نوبت" description="مراحل فقط در صورت نیاز نمایش داده می‌شوند." />
      {wizard.notice ? (
        <div
          ref={noticeRef}
          tabIndex={-1}
          className="booking-notice"
        >
          <Alert
            tone={wizard.notice === "slot_taken" ? "error" : "warning"}
            title={BOOKING_NOTICE_COPY[wizard.notice]}
            dismissible
            onDismiss={() => wizard.setNotice(undefined)}
          />
        </div>
      ) : null}
      {wizard.status === "success" ? (
        <Alert
          tone="success"
          title="در حال انتقال به صفحه تأیید"
          description="نوبت پس از پاسخ سرویس ثبت شد. درگاه پرداخت در این فاز فعال نیست."
        />
      ) : null}
      {wizard.status === "expired" ? (
        <ApiErrorState
          title="نشست منقضی شده"
          description="پس از ورود دوباره، خدمت و نوبت از نو بررسی می‌شود."
        />
      ) : null}
      {confirmError ? (
        <div ref={errorRef} tabIndex={-1} id="booking-summary-error">
          <Alert
            tone="error"
            title={confirmError.fieldErrors ? "برخی اطلاعات نیاز به اصلاح دارند" : "ثبت نوبت انجام نشد"}
            description={
              confirmError.requestId
                ? `${confirmError.message} شناسه درخواست: ${confirmError.requestId}`
                : confirmError.message
            }
          />
        </div>
      ) : null}
      <div className="booking-wizard__layout">
        <div className="booking-wizard__main">
          <div className="booking-stepper-mobile">
            <p className="text-caption">
              مرحله {Math.max(1, wizard.steps.indexOf(wizard.currentStep) + 1)} از{" "}
              {wizard.steps.length}: {currentLabel}
            </p>
          </div>
          <div className="booking-stepper-desktop">
            <Stepper
              steps={stepperItems}
              onStepSelect={(id) => wizard.goTo(id as BookingStepId)}
            />
          </div>
          <section className="booking-step-panel">
            <h2 ref={headingRef} tabIndex={-1} className="text-card-title">
              {currentLabel}
            </h2>
            {wizard.currentStep === "service" ? (
              <ServiceStep
                services={catalogQuery.data?.items ?? []}
                selectedId={wizard.draft.serviceId}
                onSelect={(id) => wizard.chooseService(id)}
                loading={catalogQuery.isPending}
                error={catalogQuery.isError ? toAppApiError(catalogQuery.error) : undefined}
                onRetry={() => void catalogQuery.refetch()}
                submitted={wizard.submitted}
              />
            ) : null}
            {wizard.currentStep === "branch" ? (
              <BranchStep
                branches={branchesQuery.data ?? []}
                selectedId={wizard.draft.branchId}
                onSelect={(id) => wizard.chooseBranch(id)}
                loading={branchesQuery.isPending}
                error={branchesQuery.isError ? toAppApiError(branchesQuery.error) : undefined}
                onRetry={() => void branchesQuery.refetch()}
                submitted={wizard.submitted}
              />
            ) : null}
            {wizard.currentStep === "provider" ? (
              <ProviderSelectionField
                serviceId={serviceId ?? undefined}
                branchId={wizard.draft.branchId ?? undefined}
                value={wizard.draft.providerPreference}
                onChange={(value) => wizard.chooseProvider(value)}
                submitted={wizard.submitted}
                contactHref={businessQuery.data?.phone ? `tel:${businessQuery.data.phone}` : undefined}
              />
            ) : null}
            {wizard.currentStep === "date" ? (
              <DateStep
                serviceId={serviceId}
                branchId={wizard.draft.branchId}
                preference={wizard.draft.providerPreference}
                requiresBranch={Boolean(
                  businessQuery.data?.branchesEnabled &&
                    (wizard.steps.includes("branch") || !wizard.draft.branchId),
                )}
                providerMode={composition.providerMode}
                selected={wizard.draft.date}
                onSelect={(iso) => wizard.chooseDate(iso)}
                timezone={businessQuery.data?.timezone}
                submitted={wizard.submitted}
              />
            ) : null}
            {wizard.currentStep === "time" ? (
              <TimeStep
                serviceId={serviceId}
                branchId={wizard.draft.branchId}
                preference={wizard.draft.providerPreference}
                requiresBranch={Boolean(
                  businessQuery.data?.branchesEnabled &&
                    (wizard.steps.includes("branch") || !wizard.draft.branchId),
                )}
                providerMode={composition.providerMode}
                date={wizard.draft.date}
                selectedId={wizard.draft.slotId}
                onSelect={(id) => wizard.chooseSlot(id)}
                timezone={businessQuery.data?.timezone}
                submitted={wizard.submitted}
                onPickAnotherDate={() => wizard.goTo("date", { force: true })}
                onBackToProvider={
                  wizard.steps.includes("provider")
                    ? () => wizard.goTo("provider", { force: true })
                    : undefined
                }
                onBackToBranch={
                  wizard.steps.includes("branch")
                    ? () => wizard.goTo("branch", { force: true })
                    : undefined
                }
              />
            ) : null}
            {wizard.currentStep === "details" ? (
              <DetailsStep
                fields={serviceQuery.data?.additionalFields ?? []}
                values={wizard.draft.additionalData}
                onChange={(id, value) => wizard.setField(id, value)}
                submitted={wizard.submitted}
              />
            ) : null}
            {wizard.currentStep === "summary" || wizard.currentStep === "checkout" ? (
              <SummaryStep
                draft={wizard.draft}
                service={serviceQuery.data}
                branch={selectedBranch}
                eligible={providersQuery.data}
                fields={serviceQuery.data?.additionalFields ?? []}
                quote={quoteQuery.data}
                quoteLoading={quoteQuery.isPending}
                quoteRefreshing={quoteQuery.isFetching && !quoteQuery.isPending}
                quoteError={quoteQuery.isError ? toAppApiError(quoteQuery.error) : undefined}
                quoteReviewed={wizard.quoteReviewed}
                quoteReceivedAt={quoteQuery.dataUpdatedAt}
                policyAccepted={policyAccepted}
                onPolicyAccepted={setPolicyAccepted}
                onEdit={editStep}
                onRetryQuote={() => void quoteQuery.refetch()}
                timezone={businessQuery.data?.timezone}
                now={quoteClock}
              />
            ) : null}
            {wizard.currentStep === "checkout" ? (
              <CheckoutStep paymentMode={quoteQuery.data?.paymentMode ?? "unknown"} />
            ) : null}
          </section>
          <div className="booking-wizard__nav">
            <Button
              variant="secondary"
              onClick={() => wizard.goPrev()}
              disabled={wizard.steps.indexOf(wizard.currentStep) <= 0 || submitting}
            >
              قبلی
            </Button>
            <Button
              onClick={() => void onContinue()}
              loading={submitting}
              disabled={
                submitting ||
                ((wizard.currentStep === "summary" || wizard.currentStep === "checkout") && !quoteReady)
              }
            >
              {wizard.currentStep === "checkout"
                ? requiresSlotHold(quoteQuery.data) ||
                  quoteQuery.data?.paymentMode === "pay_at_location"
                  ? "ادامه به پرداخت"
                  : "ثبت نهایی"
                : "ادامه"}
            </Button>
          </div>
        </div>
        <aside className="booking-wizard__aside" aria-label="خلاصه انتخاب‌ها">
          {serviceQuery.data ? <p><strong>{serviceQuery.data.name}</strong></p> : (
            <p className="text-caption">هنوز خدمتی انتخاب نشده است.</p>
          )}
          {selectedBranch ? <p>{selectedBranch.name}</p> : null}
          {wizard.draft.date ? <p className="ltr-value">{wizard.draft.date}</p> : null}
          {quoteQuery.data?.finalAmountLabel ? (
            <p>
              مبلغ کل: <strong className="ltr-value">{quoteQuery.data.finalAmountLabel}</strong>
            </p>
          ) : null}
          {quoteQuery.data?.payableNowLabel ? (
            <p>
              قابل پرداخت اکنون: <strong className="ltr-value">{quoteQuery.data.payableNowLabel}</strong>
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
