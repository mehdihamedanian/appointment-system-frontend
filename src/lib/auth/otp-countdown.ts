export function remainingSeconds(targetIso: string, nowMs: number = Date.now()): number {
  const target = Date.parse(targetIso);
  if (Number.isNaN(target)) {
    return 0;
  }
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
