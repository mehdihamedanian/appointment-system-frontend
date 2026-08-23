import type { WizardStatus } from "@/types/booking";

export type WizardEvent =
  | "initialized"
  | "dependency-start"
  | "dependency-ready"
  | "validate-start"
  | "validate-ok"
  | "submit-start"
  | "submit-ok"
  | "redirect"
  | "expire"
  | "fail"
  | "recover";

const TRANSITIONS: Record<WizardEvent, WizardStatus[]> = {
  initialized: ["initializing"],
  "dependency-start": ["ready", "validating-step", "initializing", "error"],
  "dependency-ready": ["loading-dependency", "initializing", "validating-step"],
  "validate-start": ["ready"],
  "validate-ok": ["validating-step"],
  "submit-start": ["ready"],
  "submit-ok": ["submitting"],
  redirect: ["submitting", "ready"],
  expire: ["ready", "loading-dependency", "validating-step", "submitting", "initializing"],
  fail: [
    "ready",
    "loading-dependency",
    "validating-step",
    "submitting",
    "initializing",
  ],
  recover: ["error", "expired"],
};

const NEXT: Record<WizardEvent, WizardStatus> = {
  initialized: "ready",
  "dependency-start": "loading-dependency",
  "dependency-ready": "ready",
  "validate-start": "validating-step",
  "validate-ok": "ready",
  "submit-start": "submitting",
  "submit-ok": "success",
  redirect: "redirecting",
  expire: "expired",
  fail: "error",
  recover: "ready",
};

export function canTransition(status: WizardStatus, event: WizardEvent): boolean {
  return TRANSITIONS[event].includes(status);
}

export function reduceWizardStatus(status: WizardStatus, event: WizardEvent): WizardStatus {
  if (!canTransition(status, event)) {
    return status;
  }
  return NEXT[event];
}

export function isBusyStatus(status: WizardStatus): boolean {
  return (
    status === "initializing" ||
    status === "loading-dependency" ||
    status === "validating-step" ||
    status === "submitting" ||
    status === "redirecting"
  );
}
