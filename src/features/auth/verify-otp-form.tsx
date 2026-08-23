"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authConfig } from "@/config/auth";
import { routes } from "@/constants/routes";
import { AuthFooterLinks, AuthFormAlert } from "@/features/auth/auth-form-alert";
import { OtpCountdown } from "@/features/auth/otp-countdown";
import { OtpInput } from "@/features/auth/otp-input";
import { useCompleteAuth } from "@/features/auth/use-complete-auth";
import { useSubmitting } from "@/features/auth/use-submitting";
import { resendOtp, verifyOtp } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import {
  clearAuthChallenge,
  readAuthChallenge,
  saveAuthChallenge,
  type AuthChallenge,
} from "@/lib/auth/challenge-store";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { stashResetToken } from "@/lib/auth/reset-token";

const PURPOSE_COPY: Record<AuthChallenge["purpose"], string> = {
  login: "کد ارسال‌شده برای ورود را وارد کنید.",
  register: "کد ارسال‌شده برای تکمیل ثبت‌نام را وارد کنید.",
  reset_password: "کد ارسال‌شده برای بازیابی رمز عبور را وارد کنید.",
};

export function VerifyOtpForm() {
  const router = useRouter();
  const completeAuth = useCompleteAuth("customer");
  const { submitting, run } = useSubmitting();
  const [challenge, setChallenge] = useState<AuthChallenge | null>(() => readAuthChallenge());
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);

  const description = useMemo(
    () => (challenge ? PURPOSE_COPY[challenge.purpose] : "ابتدا شماره موبایل را وارد کنید."),
    [challenge],
  );

  async function onVerify() {
    setFormMessage(null);
    if (!challenge) {
      setFormMessage({
        tone: "warning",
        title: "درخواست منقضی شده",
        description: "لطفاً دوباره شماره موبایل را وارد کنید.",
      });
      return;
    }
    if (code.length !== authConfig.otpLength) {
      setCodeError("کد را کامل وارد کنید.");
      return;
    }

    try {
      const result = await verifyOtp(challenge.challengeId, code);
      setCode("");
      if (challenge.purpose === "reset_password") {
        if (result.token) {
          stashResetToken(result.token);
        }
        clearAuthChallenge();
        router.replace(routes.auth.resetPassword);
        return;
      }
      clearAuthChallenge();
      await completeAuth(result.user);
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      setFormMessage(mapAuthError(apiError));
      setCode("");
    }
  }

  async function onResend() {
    if (!challenge) {
      return;
    }
    setFormMessage(null);
    try {
      const next = await resendOtp(challenge);
      saveAuthChallenge(next);
      setChallenge(next);
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      setFormMessage(mapAuthError(apiError));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onVerify);
  }

  const editHref =
    challenge?.purpose === "register"
      ? routes.auth.register
      : challenge?.purpose === "reset_password"
        ? routes.auth.forgotPassword
        : routes.auth.login;

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <p>{description}</p>
      {challenge ? (
        <p>
          کد به شماره <span className="ltr-value">{challenge.maskedDestination}</span> ارسال شد.{" "}
          <Link href={editHref} onClick={() => clearAuthChallenge()}>
            تغییر شماره
          </Link>
        </p>
      ) : (
        <AuthFormAlert
          message={{
            tone: "warning",
            title: "کد فعالی وجود ندارد",
            description: "از صفحه ورود یا ثبت‌نام دوباره درخواست کنید.",
          }}
        />
      )}
      <AuthFormAlert
        message={formMessage}
        onRetry={
          formMessage?.title === "ارتباط برقرار نشد"
            ? () => {
                void run(onVerify);
              }
            : undefined
        }
      />
      <OtpInput
        id="otp"
        value={code}
        error={codeError}
        disabled={submitting || !challenge}
        onChange={(value) => {
          setCode(value);
          setCodeError(undefined);
        }}
      />
      <Button type="submit" loading={submitting} disabled={submitting || !challenge} fullWidth>
        تأیید کد
      </Button>
      <OtpCountdown
        resendAvailableAt={challenge?.resendAvailableAt ?? null}
        disabled={submitting || !challenge}
        onResend={() => {
          void run(onResend);
        }}
      />
      <AuthFooterLinks>
        <Link href={editHref}>بازگشت</Link>
      </AuthFooterLinks>
    </form>
  );
}
