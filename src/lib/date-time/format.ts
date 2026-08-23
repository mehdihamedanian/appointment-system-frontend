export function formatAppointmentParts(
  iso: string,
  timeZone?: string,
): { date: string; time: string; label: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const options = {
    calendar: "gregory",
    timeZone: timeZone || undefined,
  } as const;

  try {
    const dateText = new Intl.DateTimeFormat("fa-IR", {
      ...options,
      dateStyle: "medium",
    }).format(date);
    const timeText = new Intl.DateTimeFormat("fa-IR", {
      ...options,
      timeStyle: "short",
      hourCycle: "h23",
    }).format(date);
    return {
      date: dateText,
      time: timeText,
      label: `${dateText}، ساعت ${timeText}`,
    };
  } catch {
    if (timeZone) {
      return formatAppointmentParts(iso, undefined);
    }
    return null;
  }
}

export function formatDurationMinutes(minutes: number): string {
  return `${minutes} دقیقه`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  if (abs < 60) {
    return rtf.format(Math.trunc(deltaSeconds), "second");
  }
  if (abs < 3600) {
    return rtf.format(Math.trunc(deltaSeconds / 60), "minute");
  }
  if (abs < 86400) {
    return rtf.format(Math.trunc(deltaSeconds / 3600), "hour");
  }
  return rtf.format(Math.trunc(deltaSeconds / 86400), "day");
}

export function formatCurrencyAmount(amount: number, currency?: string): string | undefined {
  if (!Number.isInteger(amount)) {
    return undefined;
  }
  try {
    return new Intl.NumberFormat("fa-IR", {
      style: currency ? "currency" : "decimal",
      currency: currency || "IRR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

export function todayIsoInTimeZone(timeZone?: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to local date.
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTimestampExpired(iso: string | undefined, now: Date = new Date()): boolean {
  if (!iso) {
    return false;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() <= now.getTime();
}
