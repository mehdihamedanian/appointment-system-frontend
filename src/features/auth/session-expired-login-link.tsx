"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withRedirectParam } from "@/lib/auth/safe-redirect";
import { routes } from "@/constants/routes";

export function SessionExpiredLoginLink() {
  const searchParams = useSearchParams();
  const href = withRedirectParam(
    routes.auth.login,
    searchParams.get("redirect") ?? routes.customer.booking,
    "customer",
  );
  return (
    <Link href={href} className="btn btn--primary">
      ورود دوباره
    </Link>
  );
}
