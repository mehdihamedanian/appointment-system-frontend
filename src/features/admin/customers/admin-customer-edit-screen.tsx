"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminCustomerForm } from "@/features/admin/customers/admin-customer-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminCustomerDetailQueryOptions } from "@/lib/api/admin-customers";
import { customerPermission } from "@/lib/admin/customer-filters";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";

export function AdminCustomerEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ customerReference: string }>();
  const reference = decodeURIComponent(params.customerReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش مشتری" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={customerPermission("edit")}>
      <AdminCustomerEditReady userId={user.id} reference={reference} />
    </PermissionGate>
  );
}

function AdminCustomerEditReady({ userId, reference }: { userId: string; reference: string }) {
  const detailQuery = useQuery(adminCustomerDetailQueryOptions(userId, reference));

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش مشتری" />
        <InlineLoading label="بارگذاری مشتری" />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = toAppApiError(detailQuery.error);
    return (
      <ApiErrorState
        title={isNotFoundError(error) ? "مشتری پیدا نشد" : "مشتری بارگذاری نشد"}
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const view = detailQuery.data;

  return (
    <>
      <AdminPageHeader
        title={`ویرایش ${view.displayName}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.customerEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.customers, label: "مشتریان" },
              { href: routes.admin.customerDetail(reference), label: view.displayName },
              { label: "ویرایش" },
            ]}
          />
        }
      />
      <AdminCustomerForm
        userId={userId}
        mode="edit"
        reference={reference}
        initial={view}
        supportsContactOverride={view.capabilities.supportsVerifiedContactOverride}
      />
    </>
  );
}
