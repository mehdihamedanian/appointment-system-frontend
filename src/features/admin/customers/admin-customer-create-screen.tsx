"use client";

import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { AdminCustomerForm } from "@/features/admin/customers/admin-customer-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { customerPermission } from "@/lib/admin/customer-filters";
import { routes } from "@/constants/routes";

export function AdminCustomerCreateScreen() {
  const { status, user } = useSession();

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="مشتری جدید" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={customerPermission("create")}>
      <AdminCustomerCreateReady userId={user.id} />
    </PermissionGate>
  );
}

function AdminCustomerCreateReady({ userId }: { userId: string }) {
  return (
    <>
      <AdminPageHeader
        title="مشتری جدید"
        description="ثبت مشتری برای این کسب‌وکار — بدون ایجاد خودکار حساب ورود."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.customerNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.customers, label: "مشتریان" },
              { label: "جدید" },
            ]}
          />
        }
      />
      <AdminCustomerForm userId={userId} mode="create" />
    </>
  );
}
