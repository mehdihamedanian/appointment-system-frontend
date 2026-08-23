"use client";

import type { ReactNode } from "react";
import {
  ApiErrorState,
  PermissionDeniedState,
  SessionExpiredState,
} from "@/components/feedback/app-states";
import { PageLoading } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { routes } from "@/constants/routes";

export type AdminAccessKind =
  | "loading"
  | "session-error"
  | "session-expired"
  | "unauthenticated"
  | "customer-rejected"
  | "permission-denied"
  | "route-denied";

export function AdminAccessState({
  kind,
  message,
  onRetry,
}: {
  kind: AdminAccessKind;
  message?: string;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return <PageLoading label="در حال بررسی دسترسی مدیریت" />;
  }

  if (kind === "session-error") {
    return (
      <ApiErrorState
        title="بررسی نشست ممکن نشد"
        description={message ?? "لطفاً دوباره تلاش کنید."}
        onRetry={onRetry}
      />
    );
  }

  if (kind === "session-expired") {
    return <SessionExpiredState />;
  }

  if (kind === "unauthenticated") {
    return (
      <PermissionDeniedState
        title="ورود لازم است"
        description="برای دسترسی به پنل مدیریت وارد حساب کارکنان شوید."
        action={
          <Button asChild>
            <Link href={routes.auth.adminLogin}>ورود مدیریت</Link>
          </Button>
        }
      />
    );
  }

  if (kind === "customer-rejected") {
    return (
      <PermissionDeniedState
        title="دسترسی مدیریت ندارید"
        description="این بخش فقط برای کاربران مجاز پنل مدیریت در دسترس است. حساب مشتری به پنل مدیریت هدایت نمی‌شود."
        action={
          <Button asChild variant="secondary">
            <Link href={routes.customer.dashboard}>بازگشت به حساب مشتری</Link>
          </Button>
        }
      />
    );
  }

  return (
    <PermissionDeniedState
      title="مجوز کافی نیست"
      description={
        message ??
        (kind === "route-denied"
          ? "مجوز لازم برای این صفحه را ندارید."
          : "این بخش فقط برای کاربران مجاز پنل مدیریت در دسترس است.")
      }
    />
  );
}

export function AdminShellLoading({ children }: { children?: ReactNode }) {
  return (
    <div className="admin-access-frame" aria-busy="true">
      {children ?? <AdminAccessState kind="loading" />}
    </div>
  );
}
