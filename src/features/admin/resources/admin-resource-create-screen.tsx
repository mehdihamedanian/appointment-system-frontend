"use client";

import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { AdminResourceForm } from "@/features/admin/resources/admin-resource-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { routes } from "@/constants/routes";

export function AdminResourceCreateScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="منبع جدید" />
        <Skeleton variant="card" />
      </>
    );
  }
  return (
    <PermissionGate permission="admin.resources.create">
      <AdminPageHeader
        title="منبع جدید"
        description="ایجاد اتاق، دستگاه یا سایر منابع عملیاتی. کارکنان را از ماژول کارکنان مدیریت کنید."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.resourceNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.resources, label: "منابع" },
              { label: "جدید" },
            ]}
          />
        }
      />
      <AdminResourceForm userId={user.id} mode="create" />
    </PermissionGate>
  );
}
