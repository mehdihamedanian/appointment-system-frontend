import { DEFAULT_AUTHENTICATED_PATH, routes } from "@/constants/routes";
import { isAnonymousOnlyAuthRoute, isAuthRoute } from "@/lib/auth/route-access";

export type RedirectAudience = "customer" | "admin";

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

export function defaultDestination(audience: RedirectAudience): string {
  return audience === "admin" ? routes.admin.home : DEFAULT_AUTHENTICATED_PATH;
}

function isAdminPath(pathname: string): boolean {
  return pathname === routes.admin.home || pathname.startsWith(`${routes.admin.home}/`);
}

export function getSafeInternalRedirect(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
  audience: RedirectAudience = "customer",
): string {
  const resolvedFallback =
    fallback === DEFAULT_AUTHENTICATED_PATH ? defaultDestination(audience) : fallback;

  if (!candidate) {
    return resolvedFallback;
  }

  const decoded = decodeRepeated(candidate.trim());
  const normalized = decoded.replace(/\\/g, "/");

  if (!normalized.startsWith("/")) {
    return resolvedFallback;
  }

  if (normalized.startsWith("//") || normalized.startsWith("/\\")) {
    return resolvedFallback;
  }

  if (UNSAFE_PROTOCOL.test(normalized)) {
    return resolvedFallback;
  }

  const pathWithQuery = normalized.split("#")[0] ?? normalized;
  const pathname = pathWithQuery.split("?")[0] ?? pathWithQuery;

  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return resolvedFallback;
  }

  if (pathname.includes("://") || pathname.includes(":")) {
    return resolvedFallback;
  }

  if (isAuthRoute(pathname) || isAnonymousOnlyAuthRoute(pathname)) {
    return resolvedFallback;
  }

  if (audience === "customer" && isAdminPath(pathname)) {
    return resolvedFallback;
  }

  if (audience === "admin" && !isAdminPath(pathname)) {
    return resolvedFallback;
  }

  return pathWithQuery;
}

export function withRedirectParam(
  loginPath: string,
  nextPath: string,
  audience: RedirectAudience = loginPath.includes("/admin") ? "admin" : "customer",
): string {
  const safeNext = getSafeInternalRedirect(nextPath, defaultDestination(audience), audience);
  const url = new URL(loginPath, "http://localhost");
  url.searchParams.set("redirect", safeNext);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
