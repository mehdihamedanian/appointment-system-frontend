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
  let current = now;
  if (input.serverNow) {
    const serverNow = Date.parse(input.serverNow);
    if (!Number.isNaN(serverNow)) {
      current = serverNow + (now - input.receivedAt);
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
