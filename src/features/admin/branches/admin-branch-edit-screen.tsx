"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminBranchForm } from "@/features/admin/branches/admin-branch-form";
import { AdminBranchesGate } from "@/features/admin/branches/admin-branches-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminBranchDetailQueryOptions } from "@/lib/api/admin-branches";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";

export function AdminBranchEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ branchReference: string }>();
  const reference = decodeURIComponent(params.branchReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش شعبه" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.branches.edit">
      <AdminBranchesGate>
        <AdminBranchEditReady userId={user.id} reference={reference} />
      </AdminBranchesGate>
    </PermissionGate>
  );
}

function AdminBranchEditReady({ userId, reference }: { userId: string; reference: string }) {
  const detailQuery = useQuery(adminBranchDetailQueryOptions(userId, reference));

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش شعبه" />
        <InlineLoading label="بارگذاری شعبه" />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = toAppApiError(detailQuery.error);
    return (
      <ApiErrorState
        title={isNotFoundError(error) ? "شعبه پیدا نشد" : "شعبه بارگذاری نشد"}
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const view = detailQuery.data;

  return (
    <>
      <AdminPageHeader
        title={`ویرایش ${view.name}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.branchEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.branches, label: "شعب" },
              { href: routes.admin.branchDetail(reference), label: view.name },
              { label: "ویرایش" },
            ]}
          />
        }
      />
      <AdminBranchForm
        userId={userId}
        mode="edit"
        reference={reference}
        initial={view}
        supportsTimezone={view.capabilities.supportsTimezoneEdit}
        supportsCoordinates={view.capabilities.supportsLocationCoordinates}
        supportsMapUrl={view.capabilities.supportsMapUrl}
      />
    </>
  );
}
