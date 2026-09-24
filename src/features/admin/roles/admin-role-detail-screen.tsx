"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useToast } from "@/components/feedback/toast";
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { AdminAccessDetailSkeleton } from "@/features/admin/access/admin-access-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminAccessConflictMessage,
  isAdminAccessConflict,
} from "@/lib/admin/access-adapter";
import {
  invalidateAfterAdminRoleMutation,
  refreshSessionAfterAccessChange,
} from "@/lib/admin/access-cache";
import { accessPermission } from "@/lib/admin/access-filters";
import {
  adminRoleDetailQueryOptions,
  deleteAdminRole,
  fetchAdminRoleImpactPreview,
} from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `role-del-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminRoleDetailScreen() {
  const params = useParams<{ roleReference: string }>();
  const { status, user, refetch } = useSession();
  const reference = params.roleReference;

  if (status === "loading" || !user?.id || !reference) {
    return <AdminAccessDetailSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("rolesView")}>
      <AdminAccessGate>
        <AdminRoleDetailReady
          sessionUserId={user.id}
          reference={reference}
          canEdit={
            hasPermission(user, accessPermission("rolesEdit")) ||
            user.permissionCodes.length === 0
          }
          canDelete={
            hasPermission(user, accessPermission("rolesDelete")) ||
            user.permissionCodes.length === 0
          }
          canViewMatrix={
            hasPermission(user, accessPermission("rolesAssignPermissions")) ||
            hasPermission(user, accessPermission("rolesEdit")) ||
            user.permissionCodes.length === 0
          }
          onSessionRefresh={() => void refetch()}
        />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminRoleDetailReady({
  sessionUserId,
  reference,
  canEdit,
  canDelete,
  canViewMatrix,
  onSessionRefresh,
}: {
  sessionUserId: string;
  reference: string;
  canEdit: boolean;
  canDelete: boolean;
  canViewMatrix: boolean;
  onSessionRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminRoleDetailQueryOptions(sessionUserId, reference));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | undefined>();

  const view = query.data;
  const error = query.isError ? toAppApiError(query.error) : undefined;

  const deleteMutation = useMutation({
    mutationFn: async () =>
      deleteAdminRole(reference, newIdempotencyKey(), { version: view?.version }),
    onSuccess: async () => {
      invalidateAfterAdminRoleMutation(queryClient, sessionUserId, reference);
      await refreshSessionAfterAccessChange(queryClient, sessionUserId, {
        affectedCurrentUser: true,
      });
      onSessionRefresh();
      toast.success("نقش حذف شد");
      router.replace(routes.admin.roles);
    },
    onError: (err) => {
      const appError = toAppApiError(err);
      if (isAdminAccessConflict(appError)) {
        toast.error(adminAccessConflictMessage());
        void query.refetch();
        return;
      }
      toast.error(appError.message);
    },
  });

  async function openDelete() {
    setBlockedReason(undefined);
    try {
      const preview = await fetchAdminRoleImpactPreview(reference, { action: "delete" });
      setSummary(preview.summaryLines);
      if (typeof preview.affectedUserCount === "number") {
        setSummary((lines) => [
          ...lines,
          `کاربران متأثر: ${new Intl.NumberFormat("fa-IR").format(preview.affectedUserCount!)}`,
        ]);
      }
      if (preview.blocked) {
        setBlockedReason(preview.blockedReason ?? "حذف این نقش مجاز نیست.");
      }
      setConfirmOpen(true);
    } catch {
      setSummary(["حذف نقش سفارشی — نقش‌های سیستمی قابل حذف نیستند."]);
      setConfirmOpen(true);
    }
  }

  if (query.isPending) return <AdminAccessDetailSkeleton />;

  if (error) {
    if (isForbiddenError(error) || isNotFoundError(error)) {
      return <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />;
    }
    return (
      <ApiErrorState
        title="بارگذاری ناموفق"
        description={error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!view) return null;

  const showEdit = canEdit && view.editable && view.allowedActions.edit !== false;
  const showDelete = canDelete && view.deletable && view.allowedActions.delete === true;

  return (
    <>
      <AdminPageHeader
        title={view.name}
        description={view.description}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.roleDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.roles, label: "نقش‌ها" },
              { label: view.name },
            ]}
          />
        }
        primaryAction={
          showEdit ? (
            <Button asChild>
              <Link href={routes.admin.roleEdit(reference)}>ویرایش</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="admin-access-detail">
        {view.system ? (
          <Alert
            tone="info"
            title="نقش سیستمی"
            description="نقش‌های سیستمی قابل حذف نیستند و ویرایش آن‌ها فقط در صورت مجاز بودن Backend نمایش داده می‌شود."
          />
        ) : null}
        {view.allowedActions.blockedReason ? (
          <Alert tone="warning" title="محدودیت" description={view.allowedActions.blockedReason} />
        ) : null}

        <dl className="admin-access-detail__meta">
          <div>
            <dt>نوع</dt>
            <dd>
              {view.system ? (
                <Badge tone="information">سیستمی</Badge>
              ) : (
                <Badge tone="neutral">سفارشی</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt>تعداد کاربران</dt>
            <dd className="ltr-value">{view.userCountLabel ?? view.userCount ?? "—"}</dd>
          </div>
        </dl>

        {canViewMatrix ? (
          <section aria-labelledby="role-permissions-title">
            <h2 id="role-permissions-title" className="text-card-title">
              مجوزها
            </h2>
            {view.permissionKeys.length === 0 ? (
              <p className="text-caption">مجوزی تخصیص داده نشده است.</p>
            ) : (
              <ul className="admin-access-permission-chips">
                {view.permissionKeys.map((key) => (
                  <li key={key} className="ltr-value">
                    {key}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="text-caption">برای مشاهده ماتریس مجوزها دسترسی لازم را ندارید.</p>
        )}

        {showDelete ? (
          <div className="admin-access-detail__actions">
            <Button
              variant="destructive"
              onClick={() => void openDelete()}
              disabled={deleteMutation.isPending}
            >
              حذف نقش
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="حذف نقش"
        description={
          blockedReason ??
          (summary.length ? summary.join(" ") : "این نقش حذف می‌شود.")
        }
        confirmLabel="حذف"
        variant="danger"
        busy={deleteMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (blockedReason) return;
          deleteMutation.mutate();
        }}
      />
    </>
  );
}
