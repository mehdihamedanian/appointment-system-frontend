"use client";

import {
  describedBy,
  FormField,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authConfig } from "@/config/auth";
import { normalizeDigits } from "@/lib/utilities/digits";
import type { ChangeEvent, ClipboardEvent } from "react";

export function OtpInput({
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  function nextValue(raw: string): string {
    return normalizeDigits(raw).replace(/\D/g, "").slice(0, authConfig.otpLength);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(nextValue(event.target.value));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    onChange(nextValue(event.clipboardData.getData("text")));
  }

  return (
    <FormField
      id={id}
      label="کد تأیید"
      required
      error={error}
      description={`${authConfig.otpLength} رقم پیامک‌شده را وارد کنید.`}
    >
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={authConfig.otpLength}
        pattern="[0-9]*"
        invalid={Boolean(error)}
        disabled={disabled}
        className="otp-input ltr-value"
        aria-describedby={describedBy(id, {
          description: "hint",
          error,
        })}
      />
    </FormField>
  );
}
