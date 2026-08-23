"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyQuoteChanged,
  applySlotTaken,
  selectBranch,
  selectDate,
  selectProviderPreference,
  selectService,
  selectSlot,
  setAdditionalValue,
} from "@/lib/booking/draft";
import { reduceWizardStatus } from "@/lib/booking/machine";
import {
  clearBookingDraft,
  draftFromPersisted,
  isBookingDraftCompleted,
  markBookingDraftCompleted,
  readBookingDraft,
  writeBookingDraft,
} from "@/lib/booking/persistence";
import { consumeHoldReturnNotice } from "@/lib/booking/hold-session";
import {
  canEnterStep,
  composeBookingSteps,
  firstIncompleteStep,
  nextStep as nextStepId,
  previousStep as previousStepId,
} from "@/lib/booking/steps";
import { isStepValid } from "@/lib/booking/validation";
import { isSafePublicId } from "@/lib/public/booking-href";
import { preferenceForMode, preferencesEqual } from "@/lib/public/provider-preference";
import type {
  AdditionalFieldDefinition,
  BookingDraft,
  BookingNotice,
  BookingStepId,
  StepCompositionContext,
  WizardStatus,
} from "@/types/booking";
import { emptyBookingDraft } from "@/types/booking";
import type { EligibleProvidersView, ProviderPreference } from "@/types/provider";

export function useBookingWizard(input: {
  composition: Omit<StepCompositionContext, "serviceSelected">;
  eligible?: EligibleProvidersView;
  additionalFields: AdditionalFieldDefinition[];
  urlService?: string | null;
  urlBranch?: string | null;
  urlProvider?: string | null;
}) {
  const [status, setStatus] = useState<WizardStatus>("initializing");
  const [draft, setDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [currentStep, setCurrentStep] = useState<BookingStepId>("service");
  const [notice, setNotice] = useState<BookingNotice>();
  const [submitted, setSubmitted] = useState(false);
  const [quoteReviewed, setQuoteReviewed] = useState(true);
  const [heldRestoredStep, setHeldRestoredStep] = useState(false);
  const restored = useRef(false);

  const steps = useMemo(
    () =>
      composeBookingSteps({
        ...input.composition,
        serviceSelected: Boolean(draft.serviceId),
      }),
    [draft.serviceId, input.composition],
  );

  const requiresBranch = steps.includes("branch");
  const validationContext = useMemo(
    () => ({
      eligible: input.eligible,
      additionalFields: input.additionalFields,
      requiresBranch,
    }),
    [input.additionalFields, input.eligible, requiresBranch],
  );

  const stepValid = useCallback(
    (id: BookingStepId) => isStepValid(id, draft, validationContext),
    [draft, validationContext],
  );

  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;
    const completed = isBookingDraftCompleted();
    if (completed) {
      clearBookingDraft();
    }
    const persisted = completed ? null : readBookingDraft();
    let next = emptyBookingDraft();
    let step: BookingStepId = "service";
    let restoredNotice: BookingNotice | undefined;
    if (persisted) {
      next = draftFromPersisted(persisted);
      step = persisted.currentStep ?? "service";
      restoredNotice = consumeHoldReturnNotice() ?? "restored";
    }
    if (input.urlService) {
      if (isSafePublicId(input.urlService)) {
        next = selectService(next, input.urlService).draft;
        if (input.urlBranch && isSafePublicId(input.urlBranch)) {
          next = selectBranch(next, input.urlBranch).draft;
        }
        if (input.urlProvider && isSafePublicId(input.urlProvider)) {
          next = selectProviderPreference(next, {
            type: "specific",
            providerId: input.urlProvider,
          }).draft;
        }
      } else {
        restoredNotice = "invalid_url_service";
      }
    }
    setDraft(next);
    setCurrentStep(step);
    setNotice(restoredNotice);
    setHeldRestoredStep(Boolean(persisted));
    setStatus((current) => reduceWizardStatus(current, "initialized"));
  }, [input.urlBranch, input.urlProvider, input.urlService]);

  const compositionReady =
    input.composition.branchesResolved &&
    input.composition.providersResolved &&
    input.composition.fieldsResolved;

  const goTo = useCallback(
    (target: BookingStepId, options?: { force?: boolean }) => {
      if (!steps.includes(target)) {
        return false;
      }
      if (!options?.force && !canEnterStep(steps, target, stepValid)) {
        return false;
      }
      setSubmitted(false);
      setCurrentStep(target);
      return true;
    },
    [stepValid, steps],
  );

  const resolvedStep =
    steps.includes(currentStep) || (heldRestoredStep && !compositionReady)
      ? currentStep
      : firstIncompleteStep(steps, stepValid);
  if (resolvedStep !== currentStep) {
    setCurrentStep(resolvedStep);
  }

  useEffect(() => {
    if (status === "initializing" || status === "success" || status === "redirecting") {
      return;
    }
    if (isBookingDraftCompleted()) {
      return;
    }
    writeBookingDraft(draft, resolvedStep);
  }, [draft, resolvedStep, status]);

  const chooseService = useCallback((serviceId: string | null) => {
    setDraft((current) => {
      const next = selectService(current, serviceId);
      if (next.notice) {
        setNotice(next.notice);
      }
      return next.draft;
    });
    setCurrentStep("service");
  }, []);

  const chooseBranch = useCallback((branchId: string | null) => {
    setDraft((current) => {
      const next = selectBranch(current, branchId);
      if (next.notice) {
        setNotice(next.notice);
      }
      return next.draft;
    });
  }, []);

  const chooseProvider = useCallback((preference: ProviderPreference | undefined) => {
    if (!preference) {
      return;
    }
    setDraft((current) => {
      const next = selectProviderPreference(current, preference);
      if (next.notice) {
        setNotice(next.notice);
      }
      return next.draft;
    });
  }, []);

  const chooseDate = useCallback((date: string | null) => {
    setDraft((current) => selectDate(current, date).draft);
  }, []);

  const chooseSlot = useCallback((slotId: string | null) => {
    setDraft((current) => selectSlot(current, slotId));
  }, []);

  const setField = useCallback((fieldId: string, value: string | boolean) => {
    setDraft((current) => setAdditionalValue(current, fieldId, value));
  }, []);

  const goNext = useCallback(() => {
    setSubmitted(true);
    if (!stepValid(resolvedStep)) {
      return false;
    }
    const next = nextStepId(steps, resolvedStep);
    if (!next) {
      return false;
    }
    setSubmitted(false);
    setCurrentStep(next);
    return true;
  }, [resolvedStep, stepValid, steps]);

  const goPrev = useCallback(() => {
    const prev = previousStepId(steps, resolvedStep);
    if (!prev) {
      return false;
    }
    setSubmitted(false);
    setCurrentStep(prev);
    return true;
  }, [resolvedStep, steps]);

  const markSlotTaken = useCallback(() => {
    setDraft((current) => {
      const next = applySlotTaken(current);
      setNotice(next.notice);
      return next.draft;
    });
    setCurrentStep("time");
  }, []);

  const markQuoteChanged = useCallback((quoteId?: string) => {
    setDraft((current) => {
      const next = applyQuoteChanged(current, quoteId);
      setNotice(next.notice);
      setQuoteReviewed(false);
      return next.draft;
    });
    setCurrentStep("summary");
  }, []);

  const applyProviderMode = useCallback((eligible: EligibleProvidersView) => {
    const automatic = preferenceForMode(eligible.mode);
    if (!automatic) {
      return;
    }
    setDraft((current) => {
      if (preferencesEqual(current.providerPreference, automatic)) {
        return current;
      }
      return selectProviderPreference(current, automatic).draft;
    });
  }, []);

  const finishSuccess = useCallback((reference?: string) => {
    markBookingDraftCompleted(reference);
    setDraft(emptyBookingDraft());
    setStatus((current) => reduceWizardStatus(current, "submit-ok"));
  }, []);

  const expire = useCallback(() => {
    setStatus((current) => reduceWizardStatus(current, "expire"));
    setNotice("session_expired");
  }, []);

  return {
    status,
    setStatus,
    draft,
    steps,
    currentStep: resolvedStep,
    notice,
    setNotice,
    submitted,
    setSubmitted,
    quoteReviewed,
    setQuoteReviewed,
    stepValid,
    goTo,
    goNext,
    goPrev,
    chooseService,
    chooseBranch,
    chooseProvider,
    chooseDate,
    chooseSlot,
    setField,
    markSlotTaken,
    markQuoteChanged,
    applyProviderMode,
    finishSuccess,
    expire,
  };
}
