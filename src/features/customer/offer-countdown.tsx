"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCountdownMmSs,
  remainingMsFromTimestamps,
} from "@/lib/date-time/server-clock";

export function OfferCountdown({
  expiresAt,
  serverNow,
  receivedAt,
  onExpired,
  label = "مهلت پاسخ به پیشنهاد",
}: {
  expiresAt: string;
  serverNow?: string;
  receivedAt: number;
  onExpired?: () => void;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const expiredNotified = useRef(false);
  const remainingMs = remainingMsFromTimestamps({
    expiresAt,
    serverNow,
    receivedAt,
    now,
  });
  const display =
    remainingMs === null ? "--:--" : formatCountdownMmSs(Math.max(0, remainingMs));
  const urgency =
    remainingMs === null
      ? "elapsed"
      : remainingMs <= 30_000
        ? "critical"
        : remainingMs <= 120_000
          ? "warning"
          : "active";

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !expiredNotified.current) {
      expiredNotified.current = true;
      onExpired?.();
    }
  }, [onExpired, remainingMs]);

  const announcement =
    urgency === "critical"
      ? "مهلت پیشنهاد رو به پایان است."
      : urgency === "warning"
        ? "مهلت پیشنهاد به‌زودی پایان می‌یابد."
        : urgency === "elapsed"
          ? "مهلت پیشنهاد به پایان رسیده است."
          : undefined;

  return (
    <div className={`offer-countdown offer-countdown--${urgency}`}>
      <p className="offer-countdown__display" aria-label={`${label} ${display}`}>
        <span className="visually-hidden">{label}</span>
        <span className="ltr-value offer-countdown__value" aria-hidden="true">
          {display}
        </span>
      </p>
      <span className="visually-hidden" aria-live="polite">
        {announcement ?? ""}
      </span>
    </div>
  );
}

export { remainingMsFromTimestamps };
