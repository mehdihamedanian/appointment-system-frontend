const LOCAL_DEV_API_BASE_URL = "http://localhost:8000/api/v1";

function readPublicString(name: string, fallback = ""): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = readPublicString(name);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readApiBaseUrl(): string {
  const configured = readPublicString("NEXT_PUBLIC_API_BASE_URL");
  if (configured) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "" : LOCAL_DEV_API_BASE_URL;
}

function readOriginList(name: string): string[] {
  return readPublicString(name)
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

export const env = {
  apiBaseUrl: readApiBaseUrl(),
  appName: readPublicString("NEXT_PUBLIC_APP_NAME", "سامانه نوبت‌دهی"),
  appTagline: readPublicString(
    "NEXT_PUBLIC_APP_TAGLINE",
    "رزرو نوبت به‌صورت آنلاین",
  ),
  siteUrl: readPublicString("NEXT_PUBLIC_SITE_URL"),
  requestTimeoutMs: readPositiveInt("NEXT_PUBLIC_REQUEST_TIMEOUT_MS", 15_000),
  sessionCookieName: readPublicString("SESSION_COOKIE_NAME", "session"),
  paymentGatewayOrigins: readOriginList("NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS"),
  allowInsecureGatewayRedirect: process.env.NODE_ENV !== "production",
} as const;
