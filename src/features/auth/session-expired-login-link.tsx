"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withRedirectParam, type RedirectAudience } from "@/lib/auth/safe-redirect";
import { routes } from "@/constants/routes";

function audienceFromRedirect(redirect: string | null): RedirectAudience {
  if (!redirect) return "customer";
  return redirect === routes.admin.home || redirect.startsWith(`${routes.admin.home}/`)
    ? "admin"
    : "customer";
}

export function SessionExpiredLoginLink() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const audience = audienceFromRedirect(redirect);
  const loginPath = audience === "admin" ? routes.auth.adminLogin : routes.auth.login;
  const fallback =
    audience === "admin" ? routes.admin.home : routes.customer.dashboard;
  const href = withRedirectParam(loginPath, redirect ?? fallback, audience);
  return (
    <Link href={href} className="btn btn--primary">
      ورود دوباره
    </Link>
  );
}
