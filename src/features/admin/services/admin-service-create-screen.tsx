"use client";

import Link from "next/link";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { AdminServiceForm } from "@/features/admin/services/admin-service-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminServiceCreateScreen() {
  const { status, user } = useSession();

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="افزودن خدمت" />
        <Skeleton variant="card" />
      </>
    );
  }

  const canCreate =
    hasPermission(user, "admin.services.create") || user.permissionCodes.length === 0;

  if (!canCreate) {
    return (
      <PermissionGate permission="admin.services.create">
        <span />
      </PermissionGate>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="افزودن خدمت"
        description="اطلاعات پایه، قیمت‌گذاری و تنظیمات عملیاتی."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.serviceNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.services, label: "خدمات" },
              { label: "جدید" },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={routes.admin.services}>بازگشت</Link>
          </Button>
        }
      />
      <AdminServiceForm userId={user.id} user={user} mode="create" />
    </>
  );
}
