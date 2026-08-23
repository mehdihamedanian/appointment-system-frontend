"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import {
  defaultDestination,
  getSafeInternalRedirect,
  type RedirectAudience,
} from "@/lib/auth/safe-redirect";
import type { SessionUser } from "@/types/session";

export function useCompleteAuth(audience: RedirectAudience) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { applyAuthenticated, refetch } = useSession();

  return async function completeAuth(user: SessionUser | null) {
    if (user) {
      applyAuthenticated(user);
    } else {
      await refetch();
    }

    router.replace(
      getSafeInternalRedirect(
        searchParams.get("redirect"),
        defaultDestination(audience),
        audience,
      ),
    );
  };
}
