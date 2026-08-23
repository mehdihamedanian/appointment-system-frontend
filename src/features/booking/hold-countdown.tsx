"use client";

import { formatCountdownMmSs, remainingMsFromTimestamps } from "@/lib/date-time/server-clock";
import { holdUrgency } from "@/lib/booking/hold-state";
import type { HoldUiState } from "@/types/hold";

export function HoldCountdown({
  remainingMs,
  state,
  label = "زمان باقی‌مانده رزرو موقت",
}: {
  remainingMs: number | null;
  state: HoldUiState;
  label?: string;
}) {
  const urgency = remainingMs === null ? "elapsed" : holdUrgency(remainingMs);
  const display = remainingMs === null ? "--:--" : formatCountdownMmSs(remainingMs);
  return (
    <p
      className={`slot-hold-countdown slot-hold-countdown--${urgency}`}
      aria-label={`${label} ${display}`}
    >
      <span className="visually-hidden">{label}</span>
      <span className="ltr-value slot-hold-countdown__value" aria-hidden="true">
        {display}
      </span>
      {state === "warning" || state === "critical" ? (
        <span className="visually-hidden">
          {state === "critical" ? "وضعیت بحرانی" : "هشدار نزدیک شدن به پایان مهلت"}
        </span>
      ) : null}
    </p>
  );
}

export { remainingMsFromTimestamps };
