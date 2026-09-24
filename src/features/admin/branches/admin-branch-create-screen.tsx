"use client";

import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { AdminBranchForm } from "@/features/admin/branches/admin-branch-form";
import { AdminBranchesGate } from "@/features/admin/branches/admin-branches-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { routes } from "@/constants/routes";

export function AdminBranchCreateScreen() {
  const { status, user } = useSession();

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="شعبه جدید" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.branches.create">
      <AdminBranchesGate>
        <AdminBranchCreateReady userId={user.id} />
      </AdminBranchesGate>
    </PermissionGate>
  );
}

function AdminBranchCreateReady({ userId }: { userId: string }) {
  return (
    <>
      <AdminPageHeader
        title="شعبه جدید"
        description="افزودن مکان جدید برای همان کسب‌وکار — نه tenant جداگانه."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.branchNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.branches, label: "شعب" },
              { label: "جدید" },
            ]}
          />
        }
      />
      <AdminBranchForm userId={userId} mode="create" />
    </>
  );
}
