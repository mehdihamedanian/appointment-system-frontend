"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { AdminServiceForm } from "@/features/admin/services/admin-service-form";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminServiceDetailQueryOptions } from "@/lib/api/admin-services";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminServiceEditScreen() {
  const { status, user } = useSession();
  const params = useParams<{ serviceReference: string }>();
  const reference = decodeURIComponent(params.serviceReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ویرایش خدمت" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.services.view">
      <AdminServiceEditReady userId={user.id} user={user} reference={reference} />
    </PermissionGate>
  );
}

function AdminServiceEditReady({
  userId,
  user,
  reference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  reference: string;
}) {
  const query = useQuery(adminServiceDetailQueryOptions(userId, reference));

  const canEdit =
    query.data?.allowedActions.edit !== false &&
    (hasPermission(user, "admin.services.edit") || user.permissionCodes.length === 0);

  if (query.isPending) {
    return (
      <>
        <AdminPageHeader title="ویرایش خدمت" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری خدمت" />
        <Skeleton variant="card" />
      </>
    );
  }

  if (query.isError || !query.data) {
    const error = toAppApiError(query.error);
    if (isForbiddenError(error) || !canEdit) {
      return <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="خدمت پیدا نشد"
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.services}>بازگشت</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="خدمت بارگذاری نشد"
        description={error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const view = query.data;

  return (
    <>
      <AdminPageHeader
        title={`ویرایش — ${view.name}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.serviceEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.services, label: "خدمات" },
              { href: view.detailHref, label: view.name },
              { label: "ویرایش" },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={view.detailHref}>جزئیات</Link>
          </Button>
        }
      />
      <AdminServiceForm
        userId={userId}
        user={user}
        mode="edit"
        reference={reference}
        initial={view}
      />
    </>
  );
}
