"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { ServiceResourceRequirementsEditor } from "@/features/admin/service-resources/service-resource-requirements-editor";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminServiceResourceRequirementsQueryOptions } from "@/lib/api/admin-service-resources";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

export function AdminServiceResourceRequirementsScreen() {
  const { status, user } = useSession();
  const params = useParams<{ serviceReference: string }>();
  const serviceReference = decodeURIComponent(params.serviceReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="نیازمندی‌های منبع" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.services.view">
      <AdminServiceResourceRequirementsReady userId={user.id} user={user} serviceReference={serviceReference} />
    </PermissionGate>
  );
}

function AdminServiceResourceRequirementsReady({
  userId,
  user,
  serviceReference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  serviceReference: string;
}) {
  const query = useQuery(adminServiceResourceRequirementsQueryOptions(userId, serviceReference));

  const canManage =
    query.data?.capabilities.canEdit !== false &&
    (hasPermission(user, "admin.services.manage_resources") ||
      hasPermission(user, "admin.services.edit") ||
      user.permissionCodes.length === 0);

  if (query.isPending) {
    return (
      <>
        <AdminPageHeader title="نیازمندی‌های منبع" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری نیازمندی‌ها" />
        <Skeleton variant="card" />
      </>
    );
  }

  if (query.isError || !query.data) {
    const error = toAppApiError(query.error);
    if (isForbiddenError(error)) {
      return <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="نیازمندی‌های منبع در دسترس نیست"
          description="Backend باید GET /admin/services/{reference}/resource-requirements را ارائه کند."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.services}>بازگشت به خدمات</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="نیازمندی‌ها بارگذاری نشد"
        description={error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const view = query.data;
  const title = view.serviceName ? `منابع — ${view.serviceName}` : "نیازمندی‌های منبع";

  return (
    <>
      <AdminPageHeader
        title={title}
        description="تعریف منابع لازم برای انجام این خدمت. تخصیص و Slot توسط Backend انجام می‌شود."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.serviceResources(serviceReference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.services, label: "خدمات" },
              { href: routes.admin.serviceDetail(serviceReference), label: view.serviceName ?? serviceReference },
              { label: "منابع" },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={routes.admin.services}>فهرست خدمات</Link>
          </Button>
        }
      />

      <ServiceResourceRequirementsEditor
        key={`${view.version ?? "v0"}-${view.updatedAt ?? ""}-${view.requirements.length}`}
        userId={userId}
        serviceReference={serviceReference}
        view={view}
        canEdit={canManage}
        onSaved={() => void query.refetch()}
      />
    </>
  );
}
