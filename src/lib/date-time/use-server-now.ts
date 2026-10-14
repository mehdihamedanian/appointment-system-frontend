"use client";

import { useEffect, useState } from "react";
import { serverNowMs } from "@/lib/date-time/server-clock";

/** Server-referenced epoch milliseconds, refreshed on an interval. */
export function useServerNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => serverNowMs());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNowMs()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
