import { ADMIN_LOGIN_PATH, LOGIN_PATH } from "@/constants/routes";
import { isAdminRoute, isCustomerRoute } from "@/lib/auth/route-access";
import { withRedirectParam } from "@/lib/auth/safe-redirect";

export type ProxyDecision =
  | { type: "next" }
  | { type: "redirect"; location: string };

/**
 * Cookie presence is not proof of a valid session, so the proxy only performs
 * the safe redirect (no cookie → login). Moving a signed-in visitor off auth
 * pages is left to the client GuestGuard, which acts on the verified session;
 * doing it here would loop whenever the cookie is stale.
 */
export function resolveProxyNavigation(input: {
  pathname: string;
  search?: string;
  hasSessionCookie: boolean;
}): ProxyDecision {
  const { pathname, search = "", hasSessionCookie } = input;

  if (hasSessionCookie) {
    return { type: "next" };
  }

  if (isCustomerRoute(pathname)) {
    return {
      type: "redirect",
      location: withRedirectParam(LOGIN_PATH, `${pathname}${search}`, "customer"),
    };
  }

  if (isAdminRoute(pathname)) {
    return {
      type: "redirect",
      location: withRedirectParam(ADMIN_LOGIN_PATH, `${pathname}${search}`, "admin"),
    };
  }

  return { type: "next" };
}
