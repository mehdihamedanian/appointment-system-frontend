"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthFormAlert } from "@/features/auth/auth-form-alert";
import { useSubmitting } from "@/features/auth/use-submitting";
import { changePassword } from "@/lib/api/auth";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { mapAuthError, type AuthFormMessage } from "@/lib/auth/error-map";
import { focusField, pickFieldError } from "@/lib/auth/form";
import {
  isPasswordLongEnough,
  PASSWORD_REQUIREMENT_COPY,
  passwordsMatch,
} from "@/lib/auth/password";

export function ChangePasswordForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { submitting, run } = useSubmitting();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    passwordConfirm?: string;
  }>({});
  const [formMessage, setFormMessage] = useState<AuthFormMessage | null>(null);

  async function onChange() {
    const next = {
      currentPassword: currentPassword ? undefined : "رمز عبور فعلی را وارد کنید.",
      newPassword: isPasswordLongEnough(newPassword) ? undefined : PASSWORD_REQUIREMENT_COPY,
      passwordConfirm: passwordsMatch(newPassword, passwordConfirm)
        ? undefined
        : "تکرار رمز عبور با رمز عبور جدید یکسان نیست.",
    };
    setFieldErrors(next);
    const first = next.currentPassword
      ? "currentPassword"
      : next.newPassword
        ? "newPassword"
        : next.passwordConfirm
          ? "passwordConfirm"
          : null;
    if (first) {
      focusField(first);
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setFormMessage({
        tone: "success",
        title: "رمز عبور تغییر کرد",
        description: "از این پس با رمز جدید وارد شوید.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirm("");
      onSuccess?.();
    } catch (error) {
      const apiError = isApiError(error) ? error : toAppApiError(error);
      setFormMessage(mapAuthError(apiError));
      setFieldErrors({
        currentPassword: pickFieldError(apiError.fieldErrors, ["currentPassword", "oldPassword"]),
        newPassword: pickFieldError(apiError.fieldErrors, ["newPassword", "password"]),
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(onChange);
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <AuthFormAlert message={formMessage} />
      <FormField
        id="currentPassword"
        label="رمز عبور فعلی"
        required
        error={fieldErrors.currentPassword}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          invalid={Boolean(fieldErrors.currentPassword)}
          disabled={submitting}
        />
      </FormField>
      <FormField
        id="newPassword"
        label="رمز عبور جدید"
        required
        error={fieldErrors.newPassword}
        description={PASSWORD_REQUIREMENT_COPY}
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          invalid={Boolean(fieldErrors.newPassword)}
          disabled={submitting}
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
          disabled={submitting}
        />
      </FormField>
      <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
        ذخیره رمز عبور
      </Button>
    </form>
  );
}
