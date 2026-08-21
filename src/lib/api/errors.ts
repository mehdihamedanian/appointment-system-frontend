import type { AppApiError } from "@/types/api";
import { isRecord, readString } from "@/lib/utilities/records";

export class ApiError extends Error implements AppApiError {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;

  constructor(error: AppApiError) {
    super(error.message);
    this.name = "ApiError";
    this.status = error.status;
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
    this.requestId = error.requestId;
  }

  toJSON(): AppApiError {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors,
      requestId: this.requestId,
    };
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function toAppApiError(value: unknown): AppApiError {
  if (isApiError(value)) {
    return value.toJSON();
  }

  if (isRecord(value) && typeof value.status === "number") {
    return {
      status: value.status,
      code: readString(value.code),
      message: readString(value.message) ?? "خطای غیرمنتظره رخ داد.",
      fieldErrors: normalizeFieldErrors(value.fieldErrors),
      requestId: readString(value.requestId),
    };
  }

  return {
    status: 0,
    message:
      value instanceof Error
        ? safeErrorMessage(value)
        : "خطای غیرمنتظره رخ داد.",
  };
}

export function isUnauthorizedError(error: AppApiError): boolean {
  return error.status === 401;
}

export function isSessionExpiredError(error: AppApiError): boolean {
  if (error.status !== 401) {
    return false;
  }

  const code = error.code?.toUpperCase() ?? "";
  return (
    code.includes("EXPIRED") ||
    code.includes("SESSION") ||
    /منقضی|منقضی‌شده/.test(error.message)
  );
}

export function isValidationError(error: AppApiError): boolean {
  return error.status === 422 || Boolean(error.fieldErrors);
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "درخواست نامعتبر است.",
  401: "برای ادامه وارد حساب خود شوید.",
  403: "دسترسی به این بخش مجاز نیست.",
  404: "مورد درخواستی پیدا نشد.",
  409: "این عملیات با وضعیت فعلی در تضاد است.",
  422: "برخی از اطلاعات واردشده معتبر نیستند.",
  429: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
};

function statusMessage(status: number): string {
  if (STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }

  if (status >= 500) {
    return "اختلالی در سرویس رخ داده است. لطفاً دوباره تلاش کنید.";
  }

  return "درخواست با خطا روبه‌رو شد.";
}

function normalizeFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const normalized = messages
        .map((item) => readString(item))
        .filter((item): item is string => Boolean(item));
      if (normalized.length > 0) {
        fieldErrors[field] = normalized;
      }
      continue;
    }

    const single = readString(messages);
    if (single) {
      fieldErrors[field] = [single];
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function collectFieldErrorsFromUnknown(body: unknown): Record<string, string[]> | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return (
    normalizeFieldErrors(body.fieldErrors) ??
    normalizeFieldErrors(body.errors) ??
    normalizeFieldErrors(body.violations)
  );
}

function readErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return readString(body.code) ?? readString(body.errorCode) ?? readString(body.error);
}

function readErrorMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (!isRecord(body)) {
    return statusMessage(status);
  }

  return (
    readString(body.message) ??
    readString(body.detail) ??
    readString(body.title) ??
    readString(body.error_description) ??
    statusMessage(status)
  );
}

function readRequestId(body: unknown, headers: Headers): string | undefined {
  const headerId =
    headers.get("x-request-id") ??
    headers.get("x-correlation-id") ??
    headers.get("x-amzn-requestid");

  if (headerId?.trim()) {
    return headerId.trim();
  }

  if (!isRecord(body)) {
    return undefined;
  }

  return readString(body.requestId) ?? readString(body.correlationId);
}

export function normalizeHttpError(
  status: number,
  body: unknown,
  headers: Headers,
): AppApiError {
  return {
    status,
    code: readErrorCode(body),
    message: readErrorMessage(body, status),
    fieldErrors: collectFieldErrorsFromUnknown(body),
    requestId: readRequestId(body, headers),
  };
}

export function normalizeNetworkError(error: unknown): AppApiError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      status: 0,
      code: "REQUEST_ABORTED",
      message: "درخواست لغو شد.",
    };
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      status: 0,
      code: "REQUEST_TIMEOUT",
      message: "زمان انتظار درخواست به پایان رسید.",
    };
  }

  return {
    status: 0,
    code: "NETWORK_ERROR",
    message: "ارتباط با سرویس برقرار نشد.",
  };
}

function safeErrorMessage(error: Error): string {
  const sensitive = /token|password|otp|secret|authorization/i;
  if (sensitive.test(error.message)) {
    return "خطای غیرمنتظره رخ داد.";
  }

  return error.message || "خطای غیرمنتظره رخ داد.";
}
