import type {
  BookingStepId,
  StepCompositionContext,
} from "@/types/booking";

export function composeBookingSteps(context: StepCompositionContext): BookingStepId[] {
  const steps: BookingStepId[] = ["service"];
  if (!context.serviceSelected) {
    return steps;
  }

  if (!context.branchesResolved || !context.providersResolved || !context.fieldsResolved) {
    return steps;
  }

  if (context.branchesEnabled && context.eligibleBranchCount > 1) {
    steps.push("branch");
  }

  if (context.providerMode === "optional" || context.providerMode === "required") {
    steps.push("provider");
  }

  steps.push("date", "time");

  if (context.additionalFieldCount > 0) {
    steps.push("details");
  }

  steps.push("summary", "checkout");
  return steps;
}

export function stepIndex(steps: BookingStepId[], id: BookingStepId): number {
  return steps.indexOf(id);
}

export function previousStep(
  steps: BookingStepId[],
  current: BookingStepId,
): BookingStepId | undefined {
  const index = stepIndex(steps, current);
  return index > 0 ? steps[index - 1] : undefined;
}

export function nextStep(
  steps: BookingStepId[],
  current: BookingStepId,
): BookingStepId | undefined {
  const index = stepIndex(steps, current);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : undefined;
}

export function canEnterStep(
  steps: BookingStepId[],
  target: BookingStepId,
  isStepValid: (id: BookingStepId) => boolean,
): boolean {
  const targetIndex = stepIndex(steps, target);
  if (targetIndex < 0) {
    return false;
  }
  for (let index = 0; index < targetIndex; index += 1) {
    const id = steps[index];
    if (id && !isStepValid(id)) {
      return false;
    }
  }
  return true;
}

export function firstIncompleteStep(
  steps: BookingStepId[],
  isStepValid: (id: BookingStepId) => boolean,
): BookingStepId {
  return steps.find((id) => !isStepValid(id)) ?? steps[steps.length - 1] ?? "service";
}

export function isBookingStepId(value: string | null | undefined): value is BookingStepId {
  return (
    value === "service" ||
    value === "branch" ||
    value === "provider" ||
    value === "date" ||
    value === "time" ||
    value === "details" ||
    value === "summary" ||
    value === "checkout"
  );
}
