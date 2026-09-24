"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminStaffForm } from "@/features/admin/staff/admin-staff-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminStaffDetailQueryOptions,
  adminStaffListQueryOptions,
} from "@/lib/api/admin-staff";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { parseAdminStaffFilters } from "@/lib/admin/staff-filters";
import { routes } from "@/constants/routes";

export function AdminStaffEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ staffReference: string }>();
  const reference = decodeURIComponent(params.staffReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش کارمند" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.staff.edit">
      <AdminStaffEditReady userId={user.id} reference={reference} />
    </PermissionGate>
  );
}

function AdminStaffEditReady({ userId, reference }: { userId: string; reference: string }) {
  const detailQuery = useQuery(adminStaffDetailQueryOptions(userId, reference));
  const listQuery = useQuery(
    adminStaffListQueryOptions(userId, parseAdminStaffFilters(new URLSearchParams())),
  );
  const serviceOptions =
    listQuery.data?.filterOptions?.services?.map((s) => ({
      value: s.id,
      label: s.name,
    })) ?? [];

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش کارمند" />
        <InlineLoading label="بارگذاری کارمند" />
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = toAppApiError(detailQuery.error);
    return (
      <ApiErrorState
        title={isNotFoundError(error) ? "کارمند پیدا نشد" : "کارمند بارگذاری نشد"}
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
            pathname={routes.admin.staffEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.staff, label: "کارکنان" },
              { href: routes.admin.staffDetail(reference), label: detailQuery.data.name },
              { label: "ویرایش" },
            ]}
          />
        }
      />
      <AdminStaffForm
        userId={userId}
        mode="edit"
        reference={reference}
        initial={detailQuery.data}
        serviceOptions={serviceOptions}
      />
    </>
  );
}
