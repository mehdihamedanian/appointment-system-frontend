import type { AppApiError } from "@/types/api";

export type AuthFormTone = "error" | "warning" | "info" | "success";

export type AuthFormMessage = {
  tone: AuthFormTone;
  title: string;
  description: string;
};

export function isRateLimited(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  return error.status === 429 || code.includes("RATE") || code.includes("TOO_MANY");
}

export function mapAuthError(error: AppApiError): AuthFormMessage {
  const code = error.code?.toUpperCase() ?? "";

  if (isRateLimited(error)) {
    return {
      tone: "warning",
      title: "تعداد تلاش بیش از حد",
      description: "لطفاً کمی بعد دوباره تلاش کنید.",
    };
  }

  if (
    code.includes("BLOCK") ||
    code.includes("INACTIVE") ||
    code.includes("DISABLED") ||
    code.includes("SUSPEND")
  ) {
    return {
      tone: "error",
      title: "حساب غیرفعال است",
      description: "ورود با این حساب در حال حاضر ممکن نیست.",
    };
  }

  if (code.includes("PERMISSION") || error.status === 403) {
    return {
      tone: "error",
      title: "دسترسی کافی نیست",
      description: "این حساب مجوز ورود به این بخش را ندارد.",
    };
  }

  if (
    code.includes("OTP_INVALID") ||
    code.includes("CODE_INVALID") ||
    code.includes("INVALID_CODE")
  ) {
    return {
      tone: "error",
      title: "کد نادرست است",
      description: "کد واردشده معتبر نیست.",
    };
  }

  if (code.includes("OTP_EXPIRED") || code.includes("CODE_EXPIRED")) {
    return {
      tone: "error",
      title: "کد منقضی شده",
      description: "کد قبلی دیگر معتبر نیست. کد جدید دریافت کنید.",
    };
  }

  if (code.includes("CHALLENGE") && code.includes("EXPIRED")) {
    return {
      tone: "error",
      title: "اعتبارسنجی منقضی شده",
      description: "لطفاً از ابتدا دوباره درخواست کنید.",
    };
  }

  if (code.includes("ATTEMPT")) {
    return {
      tone: "error",
      title: "تعداد تلاش‌ها تمام شده",
      description: "برای امنیت حساب، درخواست جدیدی ثبت کنید.",
    };
  }

  if (error.status === 409 || code.includes("EXISTS") || code.includes("CONFLICT")) {
    return {
      tone: "error",
      title: "امکان ادامه نیست",
      description: "اگر حساب دارید وارد شوید؛ در غیر این صورت اطلاعات را بررسی کنید.",
    };
  }

  if (
    error.status === 401 ||
    code.includes("CREDENTIAL") ||
    code.includes("UNAUTHORIZED")
  ) {
    return {
      tone: "error",
      title: "ورود ناموفق",
      description: "اطلاعات واردشده نادرست است.",
    };
  }

  if (error.status === 0) {
    return {
      tone: "error",
      title: "ارتباط برقرار نشد",
      description: "اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
    };
  }

  return {
    tone: "error",
    title: "درخواست انجام نشد",
    description: "لطفاً دوباره تلاش کنید.",
  };
}

