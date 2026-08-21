import {
  ADMIN_PATH_PREFIX,
  AUTH_PATHS,
  CUSTOMER_PATH_PREFIXES,
  routes,
} from "@/constants/routes";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.some((path) => matchesPrefix(pathname, path));
}

export function isAnonymousOnlyAuthRoute(pathname: string): boolean {
  return isAuthRoute(pathname) && pathname !== routes.auth.sessionExpired;
}

export function isCustomerRoute(pathname: string): boolean {
  return CUSTOMER_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_PATH_PREFIX);
}

export function isProtectedRoute(pathname: string): boolean {
  return isCustomerRoute(pathname) || isAdminRoute(pathname);
}
