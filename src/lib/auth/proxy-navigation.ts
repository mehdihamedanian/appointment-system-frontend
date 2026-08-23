import { ADMIN_LOGIN_PATH, LOGIN_PATH } from "@/constants/routes";
import {
  isAdminRoute,
  isAnonymousOnlyAuthRoute,
  isCustomerRoute,
} from "@/lib/auth/route-access";
import {
  defaultDestination,
  getSafeInternalRedirect,
  withRedirectParam,
} from "@/lib/auth/safe-redirect";

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
    const audience = pathname.startsWith("/admin") ? "admin" : "customer";
    return {
      type: "redirect",
      location: getSafeInternalRedirect(
        redirectParam,
        defaultDestination(audience),
        audience,
      ),
    };
  }

  if (!hasSessionCookie && isCustomerRoute(pathname)) {
    return {
      type: "redirect",
      location: withRedirectParam(LOGIN_PATH, `${pathname}${search}`, "customer"),
    };
  }

  if (!hasSessionCookie && isAdminRoute(pathname)) {
    return {
      type: "redirect",
      location: withRedirectParam(
        ADMIN_LOGIN_PATH,
        `${pathname}${search}`,
        "admin",
      ),
    };
  }

  return { type: "next" };
}
