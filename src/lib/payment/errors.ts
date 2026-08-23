import type { AppApiError } from "@/types/api";

export function isCouponError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return (
    code.includes("COUPON") ||
    code.includes("PROMO") ||
    code.includes("VOUCHER")
  );
}

export function couponErrorMessage(error: AppApiError): string {
  const code = error.code?.toUpperCase() ?? "";
  if (code.includes("EXPIRED")) {
    return "این کد تخفیف منقضی شده است.";
  }
  if (code.includes("LIMIT") || code.includes("USAGE")) {
    return "سقف استفاده از این کد تکمیل شده است.";
  }
  if (code.includes("APPLICABLE") || code.includes("NOT_VALID_FOR")) {
    return "این کد برای این رزرو قابل استفاده نیست.";
  }
  return error.message || "کد تخفیف معتبر نیست.";
}

export function isAlreadyPaidError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("ALREADY_PAID") || code === "PAID";
}

export function isAlreadyProcessingError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("ALREADY_PROCESSING") || code.includes("IN_PROGRESS") || code.includes("PROCESSING");
}

export function isUnsafeRedirectError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("REDIRECT") || code === "UNSAFE_GATEWAY_URL";
}
