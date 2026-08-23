"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useSubmitting } from "@/features/auth/use-submitting";
import { adminLogin } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";
import { PhoneInput } from "@/components/ui/phone-input";
import { useCompleteAuth } from "@/features/auth/use-complete-auth";
import { useSession } from "@/features/auth/session-provider";
import {
  canAccessAdminPanel,
  isAdminAccessUnknown,
} from "@/lib/permissions/access";

type FieldErrors = {
  phone?: string;
  password?: string;
};

export function AdminLoginForm() {
  const completeAuth = useCompleteAuth("admin");
  const { logout } = useSession();
  const { submitting, run } = useSubmitting();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!isValidIranMobile(phone)) {
      next.phone = "شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.";
    }
    if (!password) {
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

  async function onLogin() {
    setFormMessage(null);
    if (!validate()) {
      return;
    }

    try {
      const result = await adminLogin(normalizeIranMobile(phone), password);
      if (
        result.user &&
        !canAccessAdminPanel(result.user) &&
        !isAdminAccessUnknown(result.user)
      ) {
        await logout();
        setFormMessage({
          tone: "error",
          title: "دسترسی کافی نیست",
          description: "این حساب مجوز ورود به پنل مدیریت را ندارد.",
        });
        return;
      }
      await completeAuth(result.user);
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      setFormMessage(mapAuthError(apiError));
      setFieldErrors({
        phone: pickFieldError(apiError.fieldErrors, ["phone", "mobile", "identifier"]),
        password: pickFieldError(apiError.fieldErrors, ["password"]),
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onLogin);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert
        message={formMessage}
        onRetry={
          formMessage?.title === "ارتباط برقرار نشد"
            ? () => {
                void run(onLogin);
              }
            : undefined
        }
      />
      <FormField
        id="phone"
        label="شماره موبایل"
        required
        error={fieldErrors.phone}
      >
        <PhoneInput
          id="phone"
          name="phone"
          value={phone}
          onValueChange={setPhone}
          autoComplete="tel"
          invalid={Boolean(fieldErrors.phone)}
          disabled={submitting}
          aria-describedby={describedBy("phone", { error: fieldErrors.phone })}
        />
      </FormField>
      <FormField id="password" label="رمز عبور" required error={fieldErrors.password}>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          invalid={Boolean(fieldErrors.password)}
          disabled={submitting}
        />
      </FormField>
      <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
        ورود به پنل مدیریت
      </Button>
    </form>
  );
}
