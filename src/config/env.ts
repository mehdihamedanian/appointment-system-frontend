const LOCAL_DEV_API_BASE_URL = "http://localhost:8000/api/v1";

/*
 * Every variable is read as a literal `process.env.NAME`: Next.js inlines public values
 * into client bundles only for literal references, so a computed-key lookup is always
 * empty in the browser.
 */
function readString(value: string | undefined, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readApiBaseUrl(): string {
  const configured = readString(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (configured) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "" : LOCAL_DEV_API_BASE_URL;
}

function readOriginList(value: string | undefined): string[] {
  return readString(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      try {
        const parsed = new URL(item);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    })
    .map((item) => {
      const parsed = new URL(item);
      return `${parsed.protocol}//${parsed.host}`;
    });
}

export type CalendarSystem = "persian" | "gregorian";

const DEFAULT_BUSINESS_TIME_ZONE = "Asia/Tehran";

function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Used only when no Backend payload names a timezone (customer appointment,
 * hold, and payment reads do not). Must match the Backend business timezone.
 * Read literally so Next.js inlines it into client bundles.
 */
function readBusinessTimeZone(): string {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE?.trim();
  return raw && isSupportedTimeZone(raw) ? raw : DEFAULT_BUSINESS_TIME_ZONE;
}

function readCalendarSystem(): CalendarSystem {
  const raw = process.env.NEXT_PUBLIC_CALENDAR_SYSTEM?.trim().toLowerCase();
  return raw === "gregorian" || raw === "gregory" ? "gregorian" : "persian";
}

export const env = {
  apiBaseUrl: readApiBaseUrl(),
  appName: readString(process.env.NEXT_PUBLIC_APP_NAME, "سامانه نوبت‌دهی"),
  appTagline: readString(process.env.NEXT_PUBLIC_APP_TAGLINE, "رزرو نوبت به‌صورت آنلاین"),
  siteUrl: readString(process.env.NEXT_PUBLIC_SITE_URL),
  requestTimeoutMs: readPositiveInt(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT_MS, 15_000),
  sessionCookieName: readString(process.env.SESSION_COOKIE_NAME, "session"),
  paymentGatewayOrigins: readOriginList(process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS),
  allowInsecureGatewayRedirect: process.env.NODE_ENV !== "production",
  businessTimeZone: readBusinessTimeZone(),
  calendarSystem: readCalendarSystem(),
} as const;
