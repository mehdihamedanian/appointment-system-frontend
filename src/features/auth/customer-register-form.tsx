"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { describedBy, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/selection";
import { routes } from "@/constants/routes";
import { AuthFooterLinks, AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useCompleteAuth } from "@/features/auth/use-complete-auth";
import { useSubmitting } from "@/features/auth/use-submitting";
import { registerCustomer, requestOtp } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { saveAuthChallenge } from "@/lib/auth/challenge-store";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isPasswordLongEnough, PASSWORD_REQUIREMENT_COPY, passwordsMatch } from "@/lib/auth/password";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  passwordConfirm?: string;
  consent?: string;
};

export function CustomerRegisterForm() {
  const router = useRouter();
  const completeAuth = useCompleteAuth("customer");
  const { submitting, run } = useSubmitting();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!firstName.trim()) {
      next.firstName = "نام را وارد کنید.";
    }
    if (!lastName.trim()) {
      next.lastName = "نام خانوادگی را وارد کنید.";
    }
    if (!isValidIranMobile(phone)) {
      next.phone = "شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.";
    }
    if (!isPasswordLongEnough(password)) {
      next.password = PASSWORD_REQUIREMENT_COPY;
    }
    if (!passwordsMatch(password, passwordConfirm)) {
      next.passwordConfirm = "تکرار رمز عبور با رمز عبور یکسان نیست.";
    }
    if (!consent) {
      next.consent = "برای ایجاد حساب باید شرایط استفاده را بپذیرید.";
    }
    setFieldErrors(next);
    const order = ["firstName", "lastName", "phone", "password", "passwordConfirm", "consent"] as const;
    const first = order.find((key) => next[key]);
    if (first) {
      focusField(first);
      return false;
    }
    return true;
  }

  async function onRegister() {
    setFormMessage(null);
    if (!validate()) {
      return;
    }

    try {
      const result = await registerCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalizeIranMobile(phone),
        password,
        consent,
      });

      if (result.user) {
        await completeAuth(result.user);
        return;
      }

      const challenge =
        result.challenge ??
        (await requestOtp(normalizeIranMobile(phone), "register"));
      saveAuthChallenge(challenge);
      router.push(routes.auth.verifyOtp);
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      setFormMessage(mapAuthError(apiError));
      setFieldErrors({
        firstName: pickFieldError(apiError.fieldErrors, ["firstName", "first_name"]),
        lastName: pickFieldError(apiError.fieldErrors, ["lastName", "last_name"]),
        phone: pickFieldError(apiError.fieldErrors, ["phone", "mobile"]),
        password: pickFieldError(apiError.fieldErrors, ["password"]),
        consent: pickFieldError(apiError.fieldErrors, ["consent"]),
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onRegister);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert
        message={formMessage}
        onRetry={
          formMessage?.title === "ارتباط برقرار نشد"
            ? () => {
                void run(onRegister);
              }
            : undefined
        }
      />
      <FormField id="firstName" label="نام" required error={fieldErrors.firstName}>
        <Input
          id="firstName"
          name="given-name"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          invalid={Boolean(fieldErrors.firstName)}
          disabled={submitting}
          aria-describedby={describedBy("firstName", { error: fieldErrors.firstName })}
        />
      </FormField>
      <FormField id="lastName" label="نام خانوادگی" required error={fieldErrors.lastName}>
        <Input
          id="lastName"
          name="family-name"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          invalid={Boolean(fieldErrors.lastName)}
          disabled={submitting}
          aria-describedby={describedBy("lastName", { error: fieldErrors.lastName })}
        />
      </FormField>
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
          autoComplete="tel"
          invalid={Boolean(fieldErrors.phone)}
          disabled={submitting}
        />
      </FormField>
      <FormField
        id="password"
        label="رمز عبور"
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
          disabled={submitting}
        />
      </FormField>
      <FormField
        id="passwordConfirm"
        label="تکرار رمز عبور"
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
          disabled={submitting}
        />
      </FormField>
      <Checkbox
        id="consent"
        name="consent"
        checked={consent}
        onChange={(event) => setConsent(event.target.checked)}
        disabled={submitting}
        error={Boolean(fieldErrors.consent)}
        label="شرایط استفاده و حریم خصوصی را می‌پذیرم."
        description={fieldErrors.consent}
      />
      <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
        ایجاد حساب مشتری
      </Button>
      <AuthFooterLinks>
        <Link href={routes.auth.login}>حساب دارید؟ وارد شوید</Link>
      </AuthFooterLinks>
    </form>
  );
}
