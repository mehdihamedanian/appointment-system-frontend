"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { describedBy, FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { routes } from "@/constants/routes";
import { AuthFooterLinks, AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useSubmitting } from "@/features/auth/use-submitting";
import { resetPassword } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isPasswordLongEnough, PASSWORD_REQUIREMENT_COPY, passwordsMatch } from "@/lib/auth/password";
import { consumeResetToken } from "@/lib/auth/reset-token";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { submitting, run } = useSubmitting();
  const [token] = useState(() => searchParams.get("token") ?? consumeResetToken());
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; passwordConfirm?: string }>(
    {},
  );
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(
    token
      ? null
      : {
          tone: "error",
          title: "پیوند بازیابی نامعتبر است",
          description: "لطفاً دوباره درخواست بازیابی رمز عبور ثبت کنید.",
        },
  );
  const [succeeded, setSucceeded] = useState(false);

  async function onReset() {
    if (!token) {
      setFormMessage({
        tone: "error",
        title: "پیوند بازیابی نامعتبر است",
        description: "لطفاً دوباره درخواست بازیابی رمز عبور ثبت کنید.",
      });
      return;
    }

    const next = {
      password: isPasswordLongEnough(password) ? undefined : PASSWORD_REQUIREMENT_COPY,
      passwordConfirm: passwordsMatch(password, passwordConfirm)
        ? undefined
        : "تکرار رمز عبور با رمز عبور یکسان نیست.",
    };
    setFieldErrors(next);
    if (next.password || next.passwordConfirm) {
      focusField(next.password ? "password" : "passwordConfirm");
      return;
    }

    try {
      await resetPassword(token, password);
      setSucceeded(true);
      setFormMessage({
        tone: "success",
        title: "رمز عبور به‌روز شد",
        description: "اکنون می‌توانید با رمز جدید وارد شوید.",
      });
      window.setTimeout(() => {
        router.replace(routes.auth.login);
      }, 1200);
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      const mapped = mapAuthError(apiError);
      if (apiError.status === 404 || /EXPIRED|INVALID|TOKEN|CHALLENGE/i.test(apiError.code ?? "")) {
        setFormMessage({
          tone: "error",
          title: "اعتبار بازیابی پایان یافته",
          description: "لطفاً دوباره درخواست بازیابی رمز عبور ثبت کنید.",
        });
        return;
      }
      setFormMessage(mapped);
      setFieldErrors({
        password: pickFieldError(apiError.fieldErrors, ["password", "newPassword"]),
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onReset);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert message={formMessage} />
      <FormField
        id="password"
        label="رمز عبور جدید"
        required
        error={fieldErrors.password}
        description={PASSWORD_REQUIREMENT_COPY}
      >
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          invalid={Boolean(fieldErrors.password)}
          disabled={submitting || !token || succeeded}
          aria-describedby={describedBy("password", {
            description: PASSWORD_REQUIREMENT_COPY,
            error: fieldErrors.password,
          })}
        />
      </FormField>
      <FormField
        id="passwordConfirm"
        label="تکرار رمز عبور جدید"
        required
        error={fieldErrors.passwordConfirm}
      >
        <PasswordInput
          id="passwordConfirm"
          name="passwordConfirm"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          autoComplete="new-password"
          invalid={Boolean(fieldErrors.passwordConfirm)}
          disabled={submitting || !token || succeeded}
        />
      </FormField>
      <Button
        type="submit"
        loading={submitting}
        disabled={submitting || !token || succeeded}
        fullWidth
      >
        ذخیره رمز جدید
      </Button>
      <AuthFooterLinks>
        <Link href={routes.auth.login}>بازگشت به ورود</Link>
      </AuthFooterLinks>
    </form>
  );
}
