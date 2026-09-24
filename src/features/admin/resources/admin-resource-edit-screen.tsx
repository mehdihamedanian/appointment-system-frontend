"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminResourceForm } from "@/features/admin/resources/admin-resource-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminResourceDetailQueryOptions } from "@/lib/api/admin-resources";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";

export function AdminResourceEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ resourceReference: string }>();
  const reference = decodeURIComponent(params.resourceReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش منبع" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.resources.edit">
      <AdminResourceEditReady userId={user.id} reference={reference} />
    </PermissionGate>
  );
}

function AdminResourceEditReady({
  userId,
  reference,
}: {
  userId: string;
  reference: string;
}) {
  const detailQuery = useQuery(adminResourceDetailQueryOptions(userId, reference));

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش منبع" />
        <InlineLoading label="بارگذاری منبع" />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = toAppApiError(detailQuery.error);
    return (
      <ApiErrorState
        title={isNotFoundError(error) ? "منبع پیدا نشد" : "منبع بارگذاری نشد"}
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`ویرایش ${detailQuery.data.name}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.resourceEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.resources, label: "منابع" },
              { href: routes.admin.resourceDetail(reference), label: detailQuery.data.name },
              { label: "ویرایش" },
            ]}
          />
        }
      />
      <AdminResourceForm
        userId={userId}
        mode="edit"
        reference={reference}
        initial={detailQuery.data}
      />
    </>
  );
}
