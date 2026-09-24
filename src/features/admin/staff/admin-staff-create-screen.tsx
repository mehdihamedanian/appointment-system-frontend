"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { AdminStaffForm } from "@/features/admin/staff/admin-staff-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminStaffListQueryOptions } from "@/lib/api/admin-staff";
import { routes } from "@/constants/routes";
import { parseAdminStaffFilters } from "@/lib/admin/staff-filters";

export function AdminStaffCreateScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="کارمند جدید" />
        <Skeleton variant="card" />
      </>
    );
  }
  return (
    <PermissionGate permission="admin.staff.create">
      <AdminStaffCreateReady userId={user.id} />
    </PermissionGate>
  );
}

function AdminStaffCreateReady({ userId }: { userId: string }) {
  const listQuery = useQuery(
    adminStaffListQueryOptions(userId, parseAdminStaffFilters(new URLSearchParams())),
  );
  const serviceOptions =
    listQuery.data?.filterOptions?.services?.map((s) => ({
      value: s.id,
      label: s.name,
    })) ?? [];

  return (
    <>
      <AdminPageHeader
        title="کارمند جدید"
        description="ایجاد پرسنل داخلی. حساب ورود به پنل مدیریت جداگانه است."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.staffNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.staff, label: "کارکنان" },
              { label: "جدید" },
            ]}
          />
        }
      />
      <AdminStaffForm userId={userId} mode="create" serviceOptions={serviceOptions} />
    </>
  );
}
