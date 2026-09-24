"use client";

import Link from "next/link";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { AdminWaitingListManualEntryForm } from "@/features/admin/waiting-list/admin-waiting-list-manual-entry-form";
import { AdminWaitingListGate } from "@/features/admin/waiting-list/admin-waiting-list-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { waitingListPermission } from "@/lib/admin/waiting-list-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminWaitingListCreateScreen() {
  const { status, user } = useSession();

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ثبت درخواست" />
        <Skeleton variant="card" />
      </>
    );
  }

  const canCreate =
    hasPermission(user, waitingListPermission("create")) || user.permissionCodes.length === 0;

  if (!canCreate) {
    return (
      <PermissionGate permission={waitingListPermission("create")}>
        <span />
      </PermissionGate>
    );
  }

  return (
    <PermissionGate permission={waitingListPermission("create")}>
      <AdminWaitingListGate>
        <>
          <AdminPageHeader
            title="ثبت درخواست لیست انتظار"
            description="ثبت دستی برای مشتری. این عمل نوبت ایجاد نمی‌کند."
            breadcrumb={
              <AdminBreadcrumb
                pathname={routes.admin.waitingListNew}
                items={[
                  { href: routes.admin.home, label: "پنل مدیریت" },
                  { href: routes.admin.waitingList, label: "لیست انتظار" },
                  { label: "ثبت جدید" },
                ]}
              />
            }
            secondaryActions={
              <Button asChild variant="secondary">
                <Link href={routes.admin.waitingList}>بازگشت</Link>
              </Button>
            }
          />
          <AdminWaitingListManualEntryForm userId={user.id} user={user} />
        </>
      </AdminWaitingListGate>
    </PermissionGate>
  );
}
