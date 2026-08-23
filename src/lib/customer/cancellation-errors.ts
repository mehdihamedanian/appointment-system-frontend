import type { AppApiError } from "@/types/api";

function codeOf(error: AppApiError): string {
  return error.code?.toUpperCase() ?? "";
}

export function isAlreadyCancelledError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("ALREADY_CANCELLED") ||
    code.includes("ALREADY_CANCELED") ||
    /already cancelled|already canceled|قبلاً لغو/.test(error.message)
  );
}

export function isPolicyChangedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return code.includes("POLICY_CHANGED") || code.includes("CANCELLATION_POLICY_CHANGED");
}

export function isRefundChangedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return code.includes("REFUND_CHANGED") || code.includes("REFUND_PREVIEW_CHANGED");
}

export function isCancellationWindowExpiredError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("WINDOW_EXPIRED") ||
    code.includes("CANCELLATION_WINDOW") ||
    code.includes("DEADLINE_PASSED")
  );
}

export function isAppointmentStartedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("APPOINTMENT_STARTED") ||
    code.includes("ALREADY_STARTED") ||
    code.includes("IN_PROGRESS")
  );
}

export function isStatusChangedError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("STATUS_CHANGED") ||
    code.includes("APPOINTMENT_STATUS") ||
    (error.status === 409 && !isPolicyChangedError(error) && !isRefundChangedError(error))
  );
}

export function isNotEligibleError(error: AppApiError): boolean {
  const code = codeOf(error);
  return (
    code.includes("NOT_ELIGIBLE") ||
    code.includes("CANCELLATION_NOT_ALLOWED") ||
    error.status === 403
  );
}

export function cancellationConflictMessage(error: AppApiError): string | undefined {
  if (isAlreadyCancelledError(error)) {
    return "این نوبت قبلاً لغو شده است.";
  }
  if (isPolicyChangedError(error)) {
    return "سیاست لغو تغییر کرده است. لطفاً پیش‌نمایش به‌روز را بررسی کنید.";
  }
  if (isRefundChangedError(error)) {
    return "اطلاعات بازپرداخت تغییر کرده است. لطفاً مبلغ‌های جدید را بررسی کنید.";
  }
  if (isAppointmentStartedError(error)) {
    return "نوبت آغاز شده و دیگر قابل لغو نیست.";
  }
  if (isCancellationWindowExpiredError(error)) {
    return "مهلت لغو این نوبت به پایان رسیده است.";
  }
  if (isStatusChangedError(error)) {
    return "وضعیت نوبت تغییر کرده است. لطفاً جزئیات به‌روز را ببینید.";
  }
  if (isNotEligibleError(error)) {
    return error.message || "لغو این نوبت مجاز نیست.";
  }
  return undefined;
}
