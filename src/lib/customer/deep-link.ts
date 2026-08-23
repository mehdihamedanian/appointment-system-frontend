import { getSafeInternalRedirect } from "@/lib/auth/safe-redirect";
import { routes } from "@/constants/routes";

const ALLOWED_PREFIXES = [
  routes.customer.dashboard,
  routes.customer.booking,
  routes.customer.appointments,
  routes.customer.payments,
  routes.customer.notifications,
  routes.customer.waitingList,
  routes.customer.profile,
  routes.public.home,
  routes.public.services,
] as const;

function matchesAllowed(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getSafeCustomerDeepLink(
  candidate: string | null | undefined,
): string | undefined {
  if (!candidate) {
    return undefined;
  }

  const marker = "/__rejected_deep_link__";
  const safe = getSafeInternalRedirect(candidate, marker, "customer");
  if (safe === marker) {
    return undefined;
  }

  const pathname = safe.split("?")[0] ?? safe;
  if (!matchesAllowed(pathname)) {
    return undefined;
  }

  return safe;
}
