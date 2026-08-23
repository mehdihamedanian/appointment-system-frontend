"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { describedBy, FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { authConfig } from "@/config/auth";
import { routes } from "@/constants/routes";
import { AuthFooterLinks, AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useCompleteAuth } from "@/features/auth/use-complete-auth";
import { useSubmitting } from "@/features/auth/use-submitting";
import { loginWithPassword, requestOtp } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { saveAuthChallenge } from "@/lib/auth/challenge-store";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";

type FieldErrors = {
  phone?: string;
  password?: string;
};

export function CustomerLoginForm() {
  const router = useRouter();
  const completeAuth = useCompleteAuth("customer");
  const { submitting, run } = useSubmitting();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);
  const [lastAction, setLastAction] = useState<"password" | "otp">("password");

  function validate(requirePassword: boolean): boolean {
    const next: FieldErrors = {};
    if (!isValidIranMobile(phone)) {
      next.phone = "شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.";
    }
    if (requirePassword && !password) {
      next.password = "رمز عبور را وارد کنید.";
    }
    setFieldErrors(next);
    const first = next.phone ? "phone" : next.password ? "password" : null;
    if (first) {
      focusField(first);
      return false;
    }
    return true;
  }

  function applyApiError(error: unknown) {
    const apiError = isApiError(error) ? error : toAppApiError(error);
    const mapped = mapAuthError(apiError);
    setFormMessage(mapped);
    setFieldErrors({
      phone: pickFieldError(apiError.fieldErrors, ["phone", "mobile", "identifier"]),
      password: pickFieldError(apiError.fieldErrors, ["password"]),
    });
    const first = apiError.fieldErrors
      ? pickFieldError(apiError.fieldErrors, ["phone", "mobile", "identifier"])
        ? "phone"
        : pickFieldError(apiError.fieldErrors, ["password"])
          ? "password"
          : null
      : null;
    if (first) {
      focusField(first);
    }
  }

  async function onPasswordLogin() {
    setLastAction("password");
    setFormMessage(null);
    if (!validate(true)) {
      return;
    }

    try {
      const result = await loginWithPassword(normalizeIranMobile(phone), password);
      await completeAuth(result.user);
    } catch (error) {
      applyApiError(error);
    }
  }

  async function onOtpLogin() {
    setLastAction("otp");
    setFormMessage(null);
    if (!validate(false)) {
      return;
    }

    try {
      const challenge = await requestOtp(normalizeIranMobile(phone), "login");
      saveAuthChallenge(challenge);
      router.push(routes.auth.verifyOtp);
    } catch (error) {
      applyApiError(error);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onPasswordLogin);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert
        message={formMessage}
        onRetry={
          formMessage?.title === "ارتباط برقرار نشد"
            ? () => {
                void run(lastAction === "otp" ? onOtpLogin : onPasswordLogin);
              }
            : undefined
        }
      />
      <FormField
        id="phone"
        label="شماره موبایل"
        required
        error={fieldErrors.phone}
        description="شماره ۱۱ رقمی با ۰۹"
      >
        <PhoneInput
          id="phone"
          name="phone"
          value={phone}
          onValueChange={setPhone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="username"
          invalid={Boolean(fieldErrors.phone)}
          disabled={submitting}
          aria-describedby={describedBy("phone", {
            description: fieldErrors.phone ? undefined : "hint",
            error: fieldErrors.phone,
          })}
        />
      </FormField>
      {authConfig.customer.passwordLogin ? (
        <FormField
          id="password"
          label="رمز عبور"
          required
          error={fieldErrors.password}
        >
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            invalid={Boolean(fieldErrors.password)}
            disabled={submitting}
            aria-describedby={describedBy("password", { error: fieldErrors.password })}
          />
        </FormField>
      ) : null}
      <div className="auth-form__actions">
        <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
          ورود
        </Button>
        {authConfig.customer.otpLogin ? (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            fullWidth
            onClick={() => {
              void run(onOtpLogin);
            }}
          >
            ورود با پیامک
          </Button>
        ) : null}
      </div>
      <AuthFooterLinks>
        {authConfig.customer.passwordReset ? (
          <Link href={routes.auth.forgotPassword}>رمز عبور را فراموش کرده‌اید؟</Link>
        ) : (
          <span />
        )}
        {authConfig.customer.registration ? (
          <Link href={routes.auth.register}>ایجاد حساب مشتری</Link>
        ) : null}
      </AuthFooterLinks>
    </form>
  );
}
