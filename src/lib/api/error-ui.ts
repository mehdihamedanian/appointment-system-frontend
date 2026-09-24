import type { AppApiError } from "@/types/api";
import {
  isConflictError,
  isForbiddenError,
  isNetworkUncertaintyError,
  isNotFoundError,
  isPublicApiDisconnected,
  isSessionExpiredError,
  isUnauthorizedError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";

/**
 * UI classification for normalized API errors (Phase 44).
 * Never expose stack traces, response bodies, or secrets.
 */
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "validation"
  | "unauthorized"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "server"
  | "feature_disabled"
  | "backend_dependency"
  | "unknown";

export type ClassifiedApiError = {
  kind: ApiErrorKind;
  title: string;
  description: string;
  /** Safe to auto-retry GET-style fetches; never for non-idempotent mutations. */
  safeToRetry: boolean;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
};

const KIND_COPY: Record<ApiErrorKind, { title: string; description: string; safeToRetry: boolean }> =
  {
    network: {
      title: "ارتباط برقرار نشد",
      description: "اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
      safeToRetry: true,
    },
    timeout: {
      title: "زمان انتظار به پایان رسید",
      description: "پاسخ سرویس دیر رسید. می‌توانید دوباره تلاش کنید.",
      safeToRetry: true,
    },
    validation: {
      title: "اطلاعات نامعتبر است",
      description: "موارد مشخص‌شده را اصلاح کنید و دوباره ارسال کنید.",
      safeToRetry: false,
    },
    unauthorized: {
      title: "ورود لازم است",
      description: "برای ادامه وارد حساب خود شوید.",
      safeToRetry: false,
    },
    session_expired: {
      title: "نشست منقضی شده است",
      description: "برای ادامه دوباره وارد شوید. دادهٔ حساس پاک شده است.",
      safeToRetry: false,
    },
    forbidden: {
      title: "دسترسی مجاز نیست",
      description: "مجوز لازم را ندارید. از حساب خارج نمی‌شوید.",
      safeToRetry: false,
    },
    not_found: {
      title: "مورد پیدا نشد",
      description: "ممکن است حذف شده باشد یا شناسه اشتباه باشد.",
      safeToRetry: false,
    },
    conflict: {
      title: "وضعیت تغییر کرده است",
      description: "اطلاعات تازه را بررسی کنید؛ ارسال قبلی تکرار نمی‌شود.",
      safeToRetry: false,
    },
    rate_limit: {
      title: "تعداد درخواست زیاد است",
      description: "کمی صبر کنید و دوباره تلاش کنید.",
      safeToRetry: true,
    },
    server: {
      title: "اختلال موقت سرویس",
      description: "لطفاً کمی بعد دوباره تلاش کنید.",
      safeToRetry: true,
    },
    feature_disabled: {
      title: "قابلیت فعال نیست",
      description: "این قابلیت برای کسب‌وکار شما در دسترس نیست.",
      safeToRetry: false,
    },
    backend_dependency: {
      title: "اتصال به سرویس آماده نیست",
      description: "قرارداد Backend برای این بخش هنوز در دسترس نیست.",
      safeToRetry: false,
    },
    unknown: {
      title: "خطای غیرمنتظره",
      description: "لطفاً دوباره تلاش کنید. جزئیات فنی نمایش داده نمی‌شود.",
      safeToRetry: false,
    },
  };

function codeUpper(error: AppApiError): string {
  return error.code?.toUpperCase() ?? "";
}

export function classifyApiError(value: unknown): ClassifiedApiError {
  const error = toAppApiError(value);
  const code = codeUpper(error);

  let kind: ApiErrorKind = "unknown";

  if (code === "MISSING_API_BASE_URL" || code === "PUBLIC_BUSINESS_UNAVAILABLE") {
    kind = "backend_dependency";
  } else if (code === "FEATURE_DISABLED" || code.includes("FEATURE_DISABLED")) {
    kind = "feature_disabled";
  } else if (code === "REQUEST_TIMEOUT" || /TIMEOUT/.test(code)) {
    kind = "timeout";
  } else if (isNetworkUncertaintyError(error) || code === "NETWORK_ERROR") {
    kind = "network";
  } else if (isSessionExpiredError(error)) {
    kind = "session_expired";
  } else if (isUnauthorizedError(error)) {
    kind = "unauthorized";
  } else if (isForbiddenError(error)) {
    kind = "forbidden";
  } else if (isNotFoundError(error) && isPublicApiDisconnected(error) && code === "MISSING_API_BASE_URL") {
    kind = "backend_dependency";
  } else if (isNotFoundError(error)) {
    kind = "not_found";
  } else if (isConflictError(error)) {
    kind = "conflict";
  } else if (isValidationError(error)) {
    kind = "validation";
  } else if (error.status === 429) {
    kind = "rate_limit";
  } else if (error.status >= 500) {
    kind = "server";
  } else if (isPublicApiDisconnected(error) && error.status === 0) {
    kind = "network";
  }

  const copy = KIND_COPY[kind];
  const description =
    kind === "validation" && error.message
      ? error.message
      : kind === "conflict" && error.message
        ? error.message
        : copy.description;

  return {
    kind,
    title: copy.title,
    description,
    safeToRetry: copy.safeToRetry,
    requestId: error.requestId,
    fieldErrors: error.fieldErrors,
  };
}

/** Mutations that must never be auto-retried even if the transport looks flaky. */
export function isNonIdempotentMutationPath(path: string): boolean {
  return /\/(book|confirm|pay|refund|cancel|reschedule|hold|checkout|charge)/i.test(path);
}
