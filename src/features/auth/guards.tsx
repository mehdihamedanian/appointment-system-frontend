"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiErrorState, PermissionDeniedState } from "@/components/feedback/app-states";
import { PageLoading } from "@/components/feedback/loading-states";
import { useSession } from "@/features/auth/session-provider";
import { LOGIN_PATH, SESSION_EXPIRED_PATH } from "@/constants/routes";
import { getSafeInternalRedirect, withRedirectParam } from "@/lib/auth/safe-redirect";
import {
  canAccessAdminPanel,
  isAdminAccessUnknown,
} from "@/lib/permissions/access";

type GuardProps = {
  children: ReactNode;
};

export function GuestGuard({ children }: GuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(
        getSafeInternalRedirect(searchParams.get("redirect")),
      );
    }
  }, [router, searchParams, status]);

  if (status === "loading" || status === "authenticated") {
    return <PageLoading label="در حال بررسی نشست" />;
  }

  return children;
}

export function CustomerGuard({ children }: GuardProps) {
  const { status, message, refetch } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(withRedirectParam(LOGIN_PATH, pathname));
    }
    if (status === "expired") {
      router.replace(SESSION_EXPIRED_PATH);
    }
  }, [pathname, router, status]);

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
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(withRedirectParam(LOGIN_PATH, pathname));
    }
    if (status === "expired") {
      router.replace(SESSION_EXPIRED_PATH);
    }
  }, [pathname, router, status]);

  if (status === "loading" || status === "unauthenticated" || status === "expired") {
    return <PageLoading label="در حال بررسی دسترسی مدیریت" />;
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

  if (user && !canAccessAdminPanel(user) && !isAdminAccessUnknown(user)) {
    return (
      <PermissionDeniedState description="این بخش فقط برای کاربران مجاز پنل مدیریت در دسترس است." />
    );
  }

  return children;
}
