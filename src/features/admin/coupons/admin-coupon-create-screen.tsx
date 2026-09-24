"use client";

import Link from "next/link";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { AdminCouponForm } from "@/features/admin/coupons/admin-coupon-form";
import { AdminCouponsGate } from "@/features/admin/coupons/admin-coupons-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { couponPermission } from "@/lib/admin/coupon-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminCouponCreateScreen() {
  const { status, user } = useSession();

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="کوپن جدید" />
        <Skeleton variant="card" />
      </>
    );
  }

  const canCreate =
    hasPermission(user, couponPermission("create")) || user.permissionCodes.length === 0;

  if (!canCreate) {
    return (
      <PermissionGate permission={couponPermission("create")}>
        <span />
      </PermissionGate>
    );
  }

  return (
    <PermissionGate permission={couponPermission("create")}>
      <AdminCouponsGate>
        <>
          <AdminPageHeader
            title="کوپن جدید"
            description="تعریف کد تخفیف با محدودیت‌ها و بازه اعتبار."
            breadcrumb={
              <AdminBreadcrumb
                pathname={routes.admin.couponNew}
                items={[
                  { href: routes.admin.home, label: "پنل مدیریت" },
                  { href: routes.admin.coupons, label: "کوپن‌ها" },
                  { label: "جدید" },
                ]}
              />
            }
            secondaryActions={
              <Button asChild variant="secondary">
                <Link href={routes.admin.coupons}>بازگشت</Link>
              </Button>
            }
          />
          <AdminCouponForm userId={user.id} mode="create" />
        </>
      </AdminCouponsGate>
    </PermissionGate>
  );
}
