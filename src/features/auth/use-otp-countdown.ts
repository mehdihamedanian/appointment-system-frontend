"use client";

import { useEffect, useState } from "react";
import { formatCountdown, remainingSeconds } from "@/lib/auth/otp-countdown";

export function useOtpCountdown(resendAvailableAt: string | null) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!resendAvailableAt) {
      return;
    }

    const tick = () => {
      setNowMs(Date.now());
    };
    const intervalId = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resendAvailableAt]);

  const seconds = resendAvailableAt ? remainingSeconds(resendAvailableAt, nowMs) : 0;

  return {
    seconds,
    ready: Boolean(resendAvailableAt) && seconds <= 0,
    label: formatCountdown(seconds),
  };
}
