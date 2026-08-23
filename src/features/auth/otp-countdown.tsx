"use client";

import { Button } from "@/components/ui/button";
import { useOtpCountdown } from "@/features/auth/use-otp-countdown";

export function OtpCountdown({
  resendAvailableAt,
  disabled,
  onResend,
}: {
  resendAvailableAt: string | null;
  disabled?: boolean;
  onResend: () => void;
}) {
  const { seconds, ready, label } = useOtpCountdown(resendAvailableAt);

  return (
    <div className="otp-countdown">
      <p aria-hidden={ready || seconds <= 0}>
        {ready ? "می‌توانید کد را دوباره دریافت کنید." : `ارسال دوباره تا ${label}`}
      </p>
      <div className="visually-hidden" aria-live="polite">
        {ready ? "ارسال دوباره کد در دسترس است." : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={!ready || disabled}
        onClick={onResend}
      >
        ارسال دوباره
      </Button>
    </div>
  );
}
