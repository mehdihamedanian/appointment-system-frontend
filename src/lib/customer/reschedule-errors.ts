import type { AppApiError } from "@/types/api";

function codeOf(error: AppApiError): string {
  return error.code?.toUpperCase() ?? "";
}

export function isRescheduleSlotTakenError(error: AppApiError): boolean {
  const code = codeOf(error);
  if (code.includes("QUOTE") || code.includes("POLICY") || code.includes("PREVIEW")) {
    return false;
  }
  if (error.status === 409 && !code.includes("ALREADY")) {
    return code.includes("SLOT") || code.includes("TAKEN") || code.includes("UNAVAILABLE");
  }
  return code === "SLOT_TAKEN" || code === "TAKEN" || (code.includes("SLOT") && code.includes("TAKEN"));
}

export function isReschedulePreviewChangedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("PREVIEW_CHANGED") ||
    code.includes("POLICY_CHANGED") ||
    code.includes("RESCHEDULE_POLICY_CHANGED") ||
    code.includes("QUOTE_CHANGED")
  );
}

export function isRescheduleNotEligibleError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("NOT_ELIGIBLE") ||
    code.includes("RESCHEDULE_NOT_ALLOWED") ||
    code.includes("WINDOW_EXPIRED") ||
    code.includes("DEADLINE_PASSED") ||
    code.includes("MAX_RESCHEDULES")
  );
}

export function isRescheduleStatusChangedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return code.includes("STATUS_CHANGED") || code.includes("APPOINTMENT_STATUS");
}

export function isReschedulePaymentRequiredError(error: AppApiError): boolean {
  const code = codeOf(error);
  return code.includes("PAYMENT_REQUIRED") || code.includes("ADDITIONAL_PAYMENT");
}

export function rescheduleConflictMessage(error: AppApiError): string | undefined {
  if (isRescheduleSlotTakenError(error)) {
    return "این زمان دیگر در دسترس نیست. لطفاً ساعت دیگری انتخاب کنید.";
  }
  if (isReschedulePreviewChangedError(error)) {
    return "شرایط زمان‌بندی مجدد تغییر کرده است. لطفاً پیش‌نمایش به‌روز را بررسی کنید.";
  }
  if (isRescheduleNotEligibleError(error)) {
    return error.message || "زمان‌بندی مجدد این نوبت مجاز نیست.";
  }
  if (isRescheduleStatusChangedError(error)) {
    return "وضعیت نوبت تغییر کرده است. لطفاً جزئیات به‌روز را ببینید.";
  }
  return undefined;
}

export const RESCHEDULE_SLOT_TAKEN_MESSAGE = "این زمان دیگر در دسترس نیست.";
