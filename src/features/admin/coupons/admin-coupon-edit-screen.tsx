"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { AdminCouponForm } from "@/features/admin/coupons/admin-coupon-form";
import { AdminCouponsGate } from "@/features/admin/coupons/admin-coupons-gate";
import { AdminCouponFormSkeleton } from "@/features/admin/coupons/admin-coupon-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminCouponEditHref, couponPermission } from "@/lib/admin/coupon-filters";
import { adminCouponDetailQueryOptions } from "@/lib/api/admin-coupons";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminCouponEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ couponReference: string }>();
  const reference = decodeURIComponent(params.couponReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش کوپن" />
        <AdminCouponFormSkeleton />
      </>
    );
  }

  const canEdit =
    hasPermission(user, couponPermission("edit")) || user.permissionCodes.length === 0;

  if (!canEdit) {
    return (
      <PermissionGate permission={couponPermission("edit")}>
        <span />
      </PermissionGate>
    );
  }

  return (
    <PermissionGate permission={couponPermission("edit")}>
      <AdminCouponsGate>
        <AdminCouponEditReady userId={user.id} reference={reference} />
      </AdminCouponsGate>
    </PermissionGate>
  );
}

function AdminCouponEditReady({ userId, reference }: { userId: string; reference: string }) {
  const detailQuery = useQuery(adminCouponDetailQueryOptions(userId, reference));

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش کوپن" description="در حال بارگذاری" />
        <AdminCouponFormSkeleton />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = toAppApiError(detailQuery.error);
    if (isForbiddenError(error)) {
      return <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="کوپن پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.coupons}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="بارگذاری کوپن ناموفق بود"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const view = detailQuery.data;

  if (view.allowedActions.edit === false) {
    return (
      <EmptyState
        title="ویرایش مجاز نیست"
        description={view.allowedActions.blockedReason ?? "این کوپن دیگر قابل ویرایش نیست."}
        action={
          <Button asChild variant="secondary">
            <Link href={routes.admin.couponDetail(view.reference)}>بازگشت به جزئیات</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`ویرایش: ${view.code}`}
        description={view.title}
        breadcrumb={
          <AdminBreadcrumb
            pathname={adminCouponEditHref(view.reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.coupons, label: "کوپن‌ها" },
              { href: routes.admin.couponDetail(view.reference), label: view.code },
              { label: "ویرایش" },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={routes.admin.couponDetail(view.reference)}>انصراف</Link>
          </Button>
        }
      />
      <AdminCouponForm userId={userId} mode="edit" reference={view.reference} initial={view} />
    </>
  );
}
