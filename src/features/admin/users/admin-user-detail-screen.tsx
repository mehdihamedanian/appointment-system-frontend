"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  invalidateAfterAdminUserMutation,
  refreshSessionAfterAccessChange,
} from "@/lib/admin/access-cache";
import { accessPermission } from "@/lib/admin/access-filters";
import {
  adminUserDetailQueryOptions,
  fetchAdminUserImpactPreview,
  submitAdminUserLifecycle,
} from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminUserDetailScreen() {
  const params = useParams<{ userReference: string }>();
  const reference = params.userReference;
  const { status, user, refetch } = useSession();

  if (status === "loading" || !user?.id || !reference) {
    return <AdminAccessDetailSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("usersView")}>
      <AdminAccessGate>
        <AdminUserDetailReady
          sessionUserId={user.id}
          reference={reference}
          canEdit={
            hasPermission(user, accessPermission("usersEdit")) ||
            user.permissionCodes.length === 0
          }
          canDeactivate={
            hasPermission(user, accessPermission("usersDeactivate")) ||
            user.permissionCodes.length === 0
          }
          onSessionRefresh={() => void refetch()}
        />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminUserDetailReady({
  sessionUserId,
  reference,
  canEdit,
  canDeactivate,
  onSessionRefresh,
}: {
  sessionUserId: string;
  reference: string;
  canEdit: boolean;
  canDeactivate: boolean;
  onSessionRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminUserDetailQueryOptions(sessionUserId, reference));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [previewVersion, setPreviewVersion] = useState<string | undefined>();
  const [blockedReason, setBlockedReason] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<"activate" | "deactivate" | null>(null);

  const view = query.data;
  const error = query.isError ? toAppApiError(query.error) : undefined;

  const lifecycleMutation = useMutation({
    mutationFn: async (action: "activate" | "deactivate") => {
      return submitAdminUserLifecycle(reference, action, newIdempotencyKey(), {
        version: view?.version,
        previewVersion,
      });
    },
    onSuccess: async (_data, action) => {
      invalidateAfterAdminUserMutation(queryClient, sessionUserId, reference);
      const affectedCurrentUser = view?.isCurrentUser === true;
      await refreshSessionAfterAccessChange(queryClient, sessionUserId, {
        affectedCurrentUser,
      });
      if (affectedCurrentUser) {
        onSessionRefresh();
        if (action === "deactivate") {
          router.replace(routes.auth.sessionExpired);
          return;
        }
      }
      toast.success(action === "deactivate" ? "کاربر غیرفعال شد" : "کاربر فعال شد");
      setConfirmOpen(false);
      void query.refetch();
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

  async function openLifecycle(action: "activate" | "deactivate") {
    setPendingAction(action);
    setBlockedReason(undefined);
    try {
      const preview = await fetchAdminUserImpactPreview(reference, { action });
      setPreviewLines(preview.summaryLines);
      setPreviewVersion(preview.previewVersion);
      if (preview.sessionImpact) {
        setPreviewLines((lines) => [...lines, preview.sessionImpact!]);
      }
      if (preview.blocked) {
        setBlockedReason(preview.blockedReason ?? "این عملیات مجاز نیست.");
      }
      setConfirmOpen(true);
    } catch (err) {
      toast.error(toAppApiError(err).message);
    }
  }

  const canShowDeactivate = useMemo(() => {
    if (!view || !canDeactivate) return false;
    if (view.allowedActions.deactivate !== true) return false;
    if (view.isCurrentUser && view.allowedActions.deactivate !== true) return false;
    return view.status === "active";
  }, [view, canDeactivate]);

  const canShowActivate =
    Boolean(view) &&
    canDeactivate &&
    view?.allowedActions.activate === true &&
    view.status === "inactive";

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

  return (
    <>
      <AdminPageHeader
        title={view.displayName}
        description="جزئیات کاربر پنل مدیریت"
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.userDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.users, label: "کاربران" },
              { label: view.displayName },
            ]}
          />
        }
        primaryAction={
          canEdit && view.allowedActions.edit ? (
            <Button asChild>
              <Link href={routes.admin.userEdit(reference)}>ویرایش</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="admin-access-detail">
        {view.isCurrentUser ? (
          <Alert tone="info" title="کاربر جاری" description="این حساب، نشست فعلی شماست." />
        ) : null}
        {view.allowedActions.blockedReason ? (
          <Alert tone="warning" title="محدودیت" description={view.allowedActions.blockedReason} />
        ) : null}

        <dl className="admin-access-detail__meta">
          <div>
            <dt>وضعیت</dt>
            <dd>
              <Badge tone={view.status === "active" ? "success" : "neutral"}>
                {view.statusLabel}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>نقش</dt>
            <dd>{view.roleLabel ?? "—"}</dd>
          </div>
          <div>
            <dt>ایمیل</dt>
            <dd className="ltr-value">{view.maskedEmail ?? "—"}</dd>
          </div>
          <div>
            <dt>موبایل</dt>
            <dd className="ltr-value">{view.maskedPhone ?? "—"}</dd>
          </div>
          <div>
            <dt>دعوت</dt>
            <dd>{view.invitationStatusLabel}</dd>
          </div>
          <div>
            <dt>آخرین ورود</dt>
            <dd>{view.lastLoginLabel}</dd>
          </div>
          <div>
            <dt>پرسنل پیوندی</dt>
            <dd>
              {view.staffHref && view.staffLabel ? (
                <Link href={view.staffHref} className="ds-link">
                  {view.staffLabel}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {view.branchScopeSupported ? (
            <div>
              <dt>محدوده شعبه</dt>
              <dd>
                {view.branchScopeLabels.length > 0
                  ? view.branchScopeLabels.join("، ")
                  : "همه شعب مجاز"}
              </dd>
            </div>
          ) : null}
        </dl>

        {view.allowedActions.viewPermissions && view.permissionCodes.length > 0 ? (
          <section aria-labelledby="user-permissions-title">
            <h2 id="user-permissions-title" className="text-card-title">
              مجوزهای مؤثر
            </h2>
            <ul className="admin-access-permission-chips">
              {view.permissionCodes.map((code) => (
                <li key={code} className="ltr-value">
                  {code}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="admin-access-detail__actions">
          {canShowDeactivate ? (
            <Button
              variant="destructive"
              onClick={() => void openLifecycle("deactivate")}
              disabled={lifecycleMutation.isPending}
            >
              غیرفعال‌سازی
            </Button>
          ) : null}
          {canShowActivate ? (
            <Button onClick={() => void openLifecycle("activate")} disabled={lifecycleMutation.isPending}>
              فعال‌سازی
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={pendingAction === "deactivate" ? "غیرفعال‌سازی کاربر" : "فعال‌سازی کاربر"}
        description={
          blockedReason ??
          (previewLines.length > 0
            ? previewLines.join(" ")
            : "آیا از این تغییر مطمئن هستید؟ غیرفعال‌سازی پرسنل پیوندی را تغییر نمی‌دهد.")
        }
        confirmLabel={pendingAction === "deactivate" ? "غیرفعال کن" : "فعال کن"}
        variant={pendingAction === "deactivate" ? "danger" : "primary"}
        busy={lifecycleMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (!pendingAction || blockedReason) return;
          lifecycleMutation.mutate(pendingAction);
        }}
      />
    </>
  );
}
