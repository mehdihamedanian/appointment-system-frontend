"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminAccessState } from "@/features/admin/admin-access-state";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  ADMIN_LOGIN_PATH,
  LOGIN_PATH,
  SESSION_EXPIRED_PATH,
} from "@/constants/routes";
import {
  defaultDestination,
  getSafeInternalRedirect,
  withRedirectParam,
  type RedirectAudience,
} from "@/lib/auth/safe-redirect";
import { findAdminNavItem } from "@/lib/admin/navigation";
import {
  canAccessAdminPanel,
  isAdminAccessUnknown,
} from "@/lib/permissions/access";
import { PageLoading } from "@/components/feedback/loading-states";
import { ApiErrorState } from "@/components/feedback/app-states";

type GuardProps = {
  children: ReactNode;
};

function guestAudience(pathname: string): RedirectAudience {
  return pathname === ADMIN_LOGIN_PATH ? "admin" : "customer";
}

/**
 * `signedOut` is true when the request carried no session cookies. Such a
 * visitor cannot be authenticated, so the page renders on the server instead of
 * waiting for the client session check.
 */
export function GuestGuard({ children, signedOut = false }: GuardProps & { signedOut?: boolean }) {
  const { status, user } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const audience = guestAudience(pathname);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (audience === "admin" && user && !canAccessAdminPanel(user) && !isAdminAccessUnknown(user)) {
      router.replace(defaultDestination("customer"));
      return;
    }

    router.replace(
      getSafeInternalRedirect(
        searchParams.get("redirect"),
        defaultDestination(audience),
        audience,
      ),
    );
  }, [audience, router, searchParams, status, user]);

  if (status === "authenticated" || (status === "loading" && !signedOut)) {
    return <PageLoading label="در حال بررسی نشست" />;
  }

  return children;
}

export function CustomerGuard({ children }: GuardProps) {
  const { status, message, refetch } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const search = searchParams.toString();
    const current = search ? `${pathname}?${search}` : pathname;
    if (status === "unauthenticated") {
      router.replace(withRedirectParam(LOGIN_PATH, current, "customer"));
    }
    if (status === "expired") {
      router.replace(withRedirectParam(SESSION_EXPIRED_PATH, current, "customer"));
    }
  }, [pathname, router, searchParams, status]);

  if (status === "loading" || status === "unauthenticated" || status === "expired") {
    return <PageLoading label="در حال بررسی دسترسی" />;
  }

  if (status === "error") {
    return (
      <ApiErrorState
        title="بررسی نشست ممکن نشد"
        description={message ?? "لطفاً دوباره تلاش کنید."}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return children;
}

export function AdminGuard({ children }: GuardProps) {
  const { status, user, message, refetch } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const search = searchParams.toString();
    const current = search ? `${pathname}?${search}` : pathname;
    if (status === "unauthenticated") {
      router.replace(withRedirectParam(ADMIN_LOGIN_PATH, current, "admin"));
    }
    if (status === "expired") {
      router.replace(withRedirectParam(SESSION_EXPIRED_PATH, current, "admin"));
    }
  }, [pathname, router, searchParams, status]);

  if (status === "loading" || status === "unauthenticated" || status === "expired") {
    return <AdminAccessState kind={status === "expired" ? "session-expired" : "loading"} />;
  }

  if (status === "error") {
    return (
      <AdminAccessState
        kind="session-error"
        message={message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (user && !canAccessAdminPanel(user) && !isAdminAccessUnknown(user)) {
    return <AdminAccessState kind="customer-rejected" />;
  }

  const routePermission = findAdminNavItem(pathname)?.permission;

  return (
    <PermissionGate
      permission={routePermission}
      fallback={<AdminAccessState kind="route-denied" />}
    >
      {children}
    </PermissionGate>
  );
}
