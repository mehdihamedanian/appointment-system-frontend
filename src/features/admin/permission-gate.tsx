"use client";

import type { ReactNode } from "react";
import { PageLoading } from "@/components/feedback/loading-states";
import { PermissionDeniedState } from "@/components/feedback/app-states";
import { useSession } from "@/features/auth/session-provider";
import { hasPermission } from "@/lib/permissions/access";

/**
 * UI-only gate. Backend authorization remains authoritative.
 * When the session has no granular permission codes yet, children render
 * (panel access was already checked by AdminGuard).
 */
export function PermissionGate({
  permission,
  children,
  fallback,
  loadingLabel = "در حال بررسی مجوز",
}: {
  permission?: string;
  children: ReactNode;
  fallback?: ReactNode;
  loadingLabel?: string;
}) {
  const { status, user } = useSession();

  if (status === "loading") {
    return <PageLoading label={loadingLabel} />;
  }

  if (!permission) {
    return children;
  }

  if (!user) {
    return (
      fallback ?? (
        <PermissionDeniedState description="برای مشاهده این بخش وارد حساب مدیریت شوید." />
      )
    );
  }

  if (user.permissionCodes.length === 0 || hasPermission(user, permission)) {
    return children;
  }

  return (
    fallback ?? (
      <PermissionDeniedState description="مجوز لازم برای مشاهده این بخش را ندارید." />
    )
  );
}
