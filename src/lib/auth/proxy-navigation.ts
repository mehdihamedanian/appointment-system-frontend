import { LOGIN_PATH } from "@/constants/routes";
import { isAnonymousOnlyAuthRoute, isProtectedRoute } from "@/lib/auth/route-access";
import { getSafeInternalRedirect, withRedirectParam } from "@/lib/auth/safe-redirect";

export type ProxyDecision =
  | { type: "next" }
  | { type: "redirect"; location: string };

export function resolveProxyNavigation(input: {
  pathname: string;
  search?: string;
  redirectParam?: string | null;
  hasSessionCookie: boolean;
}): ProxyDecision {
  const { pathname, search = "", redirectParam, hasSessionCookie } = input;

  if (hasSessionCookie && isAnonymousOnlyAuthRoute(pathname)) {
    return {
      type: "redirect",
      location: getSafeInternalRedirect(redirectParam),
    };
  }

  if (!hasSessionCookie && isProtectedRoute(pathname)) {
    return {
      type: "redirect",
      location: withRedirectParam(LOGIN_PATH, `${pathname}${search}`),
    };
  }

  return { type: "next" };
}
