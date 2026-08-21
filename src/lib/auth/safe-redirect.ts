import { DEFAULT_AUTHENTICATED_PATH } from "@/constants/routes";
import { isAnonymousOnlyAuthRoute, isAuthRoute } from "@/lib/auth/route-access";

const UNSAFE_PROTOCOL = /^(https?:|javascript:|data:)/i;

function decodeRepeated(value: string): string {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      return value;
    }
  }
  return current;
}

export function getSafeInternalRedirect(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (!candidate) {
    return fallback;
  }

  const decoded = decodeRepeated(candidate.trim());
  const normalized = decoded.replace(/\\/g, "/");

  if (!normalized.startsWith("/")) {
    return fallback;
  }

  if (normalized.startsWith("//") || normalized.startsWith("/\\")) {
    return fallback;
  }

  if (UNSAFE_PROTOCOL.test(normalized)) {
    return fallback;
  }

  const pathWithQuery = normalized.split("#")[0] ?? normalized;
  const pathname = pathWithQuery.split("?")[0] ?? pathWithQuery;

  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return fallback;
  }

  if (pathname.includes("://") || pathname.includes(":")) {
    return fallback;
  }

  if (isAuthRoute(pathname) || isAnonymousOnlyAuthRoute(pathname)) {
    return fallback;
  }

  return pathWithQuery;
}

export function withRedirectParam(
  loginPath: string,
  nextPath: string,
): string {
  const safeNext = getSafeInternalRedirect(nextPath);
  const url = new URL(loginPath, "http://localhost");
  url.searchParams.set("redirect", safeNext);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
