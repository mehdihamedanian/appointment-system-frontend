function readPublicString(name: string, fallback = ""): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = readPublicString(name);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  apiBaseUrl: readPublicString("NEXT_PUBLIC_API_BASE_URL"),
  appName: readPublicString("NEXT_PUBLIC_APP_NAME", "سامانه نوبت‌دهی"),
  appTagline: readPublicString(
    "NEXT_PUBLIC_APP_TAGLINE",
    "رزرو نوبت به‌صورت آنلاین",
  ),
  requestTimeoutMs: readPositiveInt("NEXT_PUBLIC_REQUEST_TIMEOUT_MS", 15_000),
  sessionCookieName: readPublicString("SESSION_COOKIE_NAME", "session"),
} as const;
