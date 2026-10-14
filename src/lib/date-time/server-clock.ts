/**
 * Server-referenced "now" without a server-time endpoint.
 *
 * The device clock may be wrong (manual clock changes are common when device
 * timezone data is stale). Every same-origin API response carries an HTTP
 * `Date` header; the offset between it and the device clock is used for
 * expiry countdowns and past-slot checks. Second-level header precision means
 * only skews of a few seconds or more are applied.
 */
const MIN_SIGNIFICANT_SKEW_MS = 5_000;
const MAX_SAMPLE_ROUND_TRIP_MS = 10_000;
const HEADER_PRECISION_MIDPOINT_MS = 500;

let serverOffsetMs = 0;

export function recordServerDateHeader(
  header: string | null | undefined,
  sentAt: number,
  receivedAt: number,
): void {
  if (!header) return;
  const serverMs = Date.parse(header);
  const roundTrip = receivedAt - sentAt;
  if (Number.isNaN(serverMs) || roundTrip < 0 || roundTrip > MAX_SAMPLE_ROUND_TRIP_MS) {
    return;
  }
  const estimate = serverMs + HEADER_PRECISION_MIDPOINT_MS - (sentAt + roundTrip / 2);
  serverOffsetMs = Math.abs(estimate) >= MIN_SIGNIFICANT_SKEW_MS ? Math.round(estimate) : 0;
}

export function serverClockOffsetMs(): number {
  return serverOffsetMs;
}

/** Best estimate of the Backend clock, in epoch milliseconds. */
export function serverNowMs(deviceNow: number = Date.now()): number {
  return deviceNow + serverOffsetMs;
}

export function serverNow(deviceNow?: number): Date {
  return new Date(serverNowMs(deviceNow));
}

export function resetServerClock(): void {
  serverOffsetMs = 0;
}

/**
 * Remaining time is always derived from Backend timestamps plus elapsed local
 * time since the payload was received. The UI never decrements a stored counter
 * and never extends expiresAt.
 */
export function remainingMsFromTimestamps(input: {
  expiresAt?: string;
  serverNow?: string;
  receivedAt: number;
  now?: number;
}): number | null {
  if (!input.expiresAt) {
    return null;
  }
  const expires = Date.parse(input.expiresAt);
  if (Number.isNaN(expires)) {
    return null;
  }
  const now = input.now ?? Date.now();
  let current = serverNowMs(now);
  if (input.serverNow) {
    const payloadNow = Date.parse(input.serverNow);
    if (!Number.isNaN(payloadNow)) {
      current = payloadNow + (now - input.receivedAt);
    }
  }
  return expires - current;
}

export function formatCountdownMmSs(remainingMs: number): string {
  const bounded = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(bounded / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
