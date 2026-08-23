"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { routes } from "@/constants/routes";
import { AuthFooterLinks, AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useSubmitting } from "@/features/auth/use-submitting";
import { requestPasswordReset } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { saveAuthChallenge } from "@/lib/auth/challenge-store";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import { isValidIranMobile, normalizeIranMobile } from "@/lib/auth/phone";

const PRIVACY_SAFE_SUCCESS: AuthFormMessage = {
  tone: "success",
  title: "درخواست ثبت شد",
  description:
    "اگر حسابی با این اطلاعات وجود داشته باشد، دستورالعمل بازیابی ارسال شده است.",
};

export function ForgotPasswordForm() {
  const router = useRouter();
  const { submitting, run } = useSubmitting();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);

  async function onRequest() {
    setFormMessage(null);
    if (!isValidIranMobile(phone)) {
      setPhoneError("شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.");
      focusField("phone");
      return;
    }

    try {
      const result = await requestPasswordReset(normalizeIranMobile(phone));
      setFormMessage(PRIVACY_SAFE_SUCCESS);
      if (result.challenge) {
        saveAuthChallenge(result.challenge);
        router.push(routes.auth.verifyOtp);
      }
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      if (apiError.status === 0 || apiError.status === 429) {
        setFormMessage(mapAuthError(apiError));
        setPhoneError(pickFieldError(apiError.fieldErrors, ["phone", "mobile"]));
        return;
      }
      setFormMessage(PRIVACY_SAFE_SUCCESS);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onRequest);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert
        message={formMessage}
        onRetry={
          formMessage?.title === "ارتباط برقرار نشد" || formMessage?.title === "تعداد تلاش بیش از حد"
            ? () => {
                void run(onRequest);
              }
            : undefined
        }
      />
      <FormField
        id="phone"
        label="شماره موبایل"
        required
        error={phoneError}
        description="شماره ۱۱ رقمی با ۰۹"
      >
        <PhoneInput
          id="phone"
          name="phone"
          value={phone}
          onValueChange={(value) => {
            setPhone(value);
            setPhoneError(undefined);
          }}
          autoComplete="tel"
          invalid={Boolean(phoneError)}
          disabled={submitting}
        />
      </FormField>
      <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
        ارسال دستورالعمل بازیابی
      </Button>
      <AuthFooterLinks>
        <Link href={routes.auth.login}>بازگشت به ورود</Link>
      </AuthFooterLinks>
    </form>
  );
}
