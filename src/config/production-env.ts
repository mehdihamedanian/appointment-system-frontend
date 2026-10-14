/**
 * Release gate for `next build` / `next start`. `NEXT_PUBLIC_*` values are inlined
 * at build time, so a missing or malformed value would otherwise ship silently.
 */

export type ProductionEnvReport = {
  errors: string[];
  warnings: string[];
};

type EnvSource = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function read(source: EnvSource, name: string): string {
  return source[name]?.trim() ?? "";
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function requiresHttps(url: URL): boolean {
  return url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname);
}

function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateProductionEnv(source: EnvSource): ProductionEnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const apiBase = read(source, "NEXT_PUBLIC_API_BASE_URL");
  const apiUrl = apiBase ? parseHttpUrl(apiBase) : null;
  if (!apiBase) {
    errors.push("NEXT_PUBLIC_API_BASE_URL is required (Backend API base, e.g. https://api.example.com/api/v1).");
  } else if (!apiUrl) {
    errors.push("NEXT_PUBLIC_API_BASE_URL must be an absolute http(s) URL.");
  } else if (requiresHttps(apiUrl)) {
    errors.push("NEXT_PUBLIC_API_BASE_URL must use https outside localhost.");
  }

  const siteUrl = read(source, "NEXT_PUBLIC_SITE_URL");
  if (!siteUrl) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL is empty: absolute links are disabled and the API proxy only trusts same-host origins.",
    );
  } else {
    const parsed = parseHttpUrl(siteUrl);
    if (!parsed) errors.push("NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL.");
    else if (requiresHttps(parsed)) errors.push("NEXT_PUBLIC_SITE_URL must use https outside localhost.");
  }

  const gatewayOrigins = read(source, "NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (gatewayOrigins.length === 0) {
    warnings.push(
      "NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS is empty: every online-payment redirect will be refused.",
    );
  }
  for (const origin of gatewayOrigins) {
    const parsed = parseHttpUrl(origin);
    if (!parsed) errors.push(`NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS has an invalid URL: "${origin}".`);
    else if (requiresHttps(parsed)) {
      errors.push(`NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS must use https: "${origin}".`);
    }
  }

  const timeZone = read(source, "NEXT_PUBLIC_BUSINESS_TIMEZONE");
  if (!timeZone) {
    warnings.push("NEXT_PUBLIC_BUSINESS_TIMEZONE is not set: using Asia/Tehran; it must match the Backend.");
  } else if (!isSupportedTimeZone(timeZone)) {
    errors.push(`NEXT_PUBLIC_BUSINESS_TIMEZONE is not a valid IANA timezone: "${timeZone}".`);
  }

  const calendar = read(source, "NEXT_PUBLIC_CALENDAR_SYSTEM").toLowerCase();
  if (calendar && !["persian", "gregorian", "gregory"].includes(calendar)) {
    errors.push(`NEXT_PUBLIC_CALENDAR_SYSTEM must be "persian" or "gregorian", got "${calendar}".`);
  }

  const timeout = read(source, "NEXT_PUBLIC_REQUEST_TIMEOUT_MS");
  if (timeout && !/^[1-9]\d*$/.test(timeout)) {
    errors.push("NEXT_PUBLIC_REQUEST_TIMEOUT_MS must be a positive integer (milliseconds).");
  }

  const maxAge = read(source, "SESSION_MAX_AGE_SECONDS");
  if (maxAge && !/^[1-9]\d*$/.test(maxAge)) {
    errors.push("SESSION_MAX_AGE_SECONDS must be a positive integer (seconds).");
  }

  const cookieName = read(source, "SESSION_COOKIE_NAME");
  if (cookieName && !/^[A-Za-z0-9_-]+$/.test(cookieName)) {
    errors.push("SESSION_COOKIE_NAME may only contain letters, digits, '_' and '-'.");
  }

  const clientIpHeader = read(source, "TRUSTED_CLIENT_IP_HEADER").toLowerCase();
  if (!clientIpHeader) {
    warnings.push(
      "TRUSTED_CLIENT_IP_HEADER is not set: the Backend sees this server's IP for every user, so per-IP rate limits and audit IPs are shared.",
    );
  } else if (!/^[a-z0-9-]+$/.test(clientIpHeader)) {
    errors.push("TRUSTED_CLIENT_IP_HEADER must be a single header name (e.g. x-real-ip).");
  } else if (clientIpHeader === "x-forwarded-for" || clientIpHeader === "forwarded") {
    errors.push(
      "TRUSTED_CLIENT_IP_HEADER must be a single-valued header the ingress overwrites (e.g. x-real-ip), not a client-extendable list.",
    );
  }

  return { errors, warnings };
}
