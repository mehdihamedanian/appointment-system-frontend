"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/feedback/toast";
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { AdminAccessDetailSkeleton } from "@/features/admin/access/admin-access-skeleton";
import { AdminPermissionMatrix } from "@/features/admin/access/admin-permission-matrix";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminAccessConflictMessage,
  buildLocalPermissionDiff,
  isAdminAccessConflict,
  isDuplicateAccessError,
} from "@/lib/admin/access-adapter";
import {
  invalidateAfterAdminRoleMutation,
  refreshSessionAfterAccessChange,
} from "@/lib/admin/access-cache";
import { accessPermission } from "@/lib/admin/access-filters";
import {
  adminPermissionCatalogQueryOptions,
  adminRoleDetailQueryOptions,
  createAdminRole,
  fetchAdminRoleImpactPreview,
  updateAdminRole,
} from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminRoleDetailView } from "@/types/admin-access";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `role-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type RoleDraft = {
  name: string;
  description: string;
  permissionKeys: string[];
};

function baselineFromRole(view: AdminRoleDetailView): RoleDraft {
  return {
    name: view.name,
    description: view.description ?? "",
    permissionKeys: view.permissionKeys,
  };
}

export function AdminRoleCreateScreen() {
  const { status, user, refetch } = useSession();
  if (status === "loading" || !user?.id) return <AdminAccessDetailSkeleton />;

  return (
    <PermissionGate permission={accessPermission("rolesCreate")}>
      <AdminAccessGate>
        <AdminRoleForm mode="create" sessionUserId={user.id} onSessionRefresh={() => void refetch()} />
      </AdminAccessGate>
    </PermissionGate>
  );
}

export function AdminRoleEditScreen() {
  const params = useParams<{ roleReference: string }>();
  const { status, user, refetch } = useSession();
  if (status === "loading" || !user?.id || !params.roleReference) {
    return <AdminAccessDetailSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("rolesEdit")}>
      <AdminAccessGate>
        <AdminRoleForm
          mode="edit"
          sessionUserId={user.id}
          reference={params.roleReference}
          onSessionRefresh={() => void refetch()}
        />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminRoleForm({
  mode,
  sessionUserId,
  reference,
  onSessionRefresh,
}: {
  mode: "create" | "edit";
  sessionUserId: string;
  reference?: string;
  onSessionRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery(adminPermissionCatalogQueryOptions(sessionUserId));
  const detailQuery = useQuery({
    ...adminRoleDetailQueryOptions(sessionUserId, reference ?? ""),
    enabled: mode === "edit" && Boolean(reference),
  });

  const [draft, setDraft] = useState<RoleDraft | null>(
    mode === "create" ? { name: "", description: "", permissionKeys: [] } : null,
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  const view = detailQuery.data;
  const active =
    draft ??
    (mode === "edit" && view ? baselineFromRole(view) : { name: "", description: "", permissionKeys: [] });
  const initialKeys = view?.permissionKeys ?? [];
  const dirty =
    mode === "create"
      ? Boolean(active.name || active.description || active.permissionKeys.length)
      : draft !== null;
  useUnsavedChangesWarning(dirty);

  function updateDraft(patch: Partial<RoleDraft>) {
    setDraft((current) => {
      const base =
        current ??
        (mode === "edit" && view
          ? baselineFromRole(view)
          : { name: "", description: "", permissionKeys: [] });
      return { ...base, ...patch };
    });
  }

  const catalog = catalogQuery.data?.items ?? [];
  const canAssign =
    mode === "create" ||
    view?.allowedActions.assignPermissions !== false ||
    view?.editable;

  async function prepareSave() {
    setFormError(undefined);
    setBlockedReason(undefined);
    if (!active.name.trim()) {
      setFormError("نام نقش الزامی است.");
      return;
    }

    const local = buildLocalPermissionDiff(initialKeys, active.permissionKeys);
    try {
      const preview = await fetchAdminRoleImpactPreview(reference ?? "new", {
        name: active.name.trim(),
        description: active.description.trim() || undefined,
        permissionKeys: active.permissionKeys,
        version: view?.version,
      });
      const lines = [...preview.summaryLines];
      if (preview.grantedPermissions.length === 0 && preview.revokedPermissions.length === 0) {
        lines.push(...local.summaryLines);
      }
      if (typeof preview.affectedUserCount === "number") {
        lines.push(
          `کاربران متأثر: ${new Intl.NumberFormat("fa-IR").format(preview.affectedUserCount)}`,
        );
      }
      setSummary(lines);
      if (preview.blocked) {
        setBlockedReason(preview.blockedReason ?? "ذخیره این نقش مجاز نیست.");
      }
      setConfirmOpen(true);
    } catch {
      setSummary(local.summaryLines);
      setConfirmOpen(true);
    }
  }

  async function submitSave() {
    if (blockedReason) return;
    setSubmitting(true);
    setConflict(false);
    try {
      if (mode === "create") {
        const created = await createAdminRole(
          {
            name: active.name.trim(),
            description: active.description.trim() || undefined,
            permissionKeys: active.permissionKeys,
          },
          newIdempotencyKey(),
        );
        invalidateAfterAdminRoleMutation(queryClient, sessionUserId, created.reference);
        setDraft(null);
        toast.success("نقش ایجاد شد");
        router.replace(routes.admin.roleDetail(created.reference));
      } else if (reference) {
        await updateAdminRole(
          reference,
          {
            name: active.name.trim(),
            description: active.description.trim() || undefined,
            permissionKeys: active.permissionKeys,
            version: view?.version,
          },
          newIdempotencyKey(),
        );
        invalidateAfterAdminRoleMutation(queryClient, sessionUserId, reference);
        await refreshSessionAfterAccessChange(queryClient, sessionUserId, {
          affectedCurrentUser: true,
        });
        onSessionRefresh();
        setDraft(null);
        toast.success("نقش به‌روزرسانی شد");
        router.replace(routes.admin.roleDetail(reference));
      }
      setConfirmOpen(false);
    } catch (err) {
      const appError = toAppApiError(err);
      if (isAdminAccessConflict(appError)) {
        setConflict(true);
        setConfirmOpen(false);
        setDraft(null);
        toast.error(adminAccessConflictMessage());
        void detailQuery.refetch();
        return;
      }
      if (isDuplicateAccessError(appError)) {
        setFormError("نقشی با این نام از قبل وجود دارد.");
        setConfirmOpen(false);
        return;
      }
      toast.error(appError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "edit" && detailQuery.isPending) return <AdminAccessDetailSkeleton />;

  if (mode === "edit" && detailQuery.isError) {
    const error = toAppApiError(detailQuery.error);
    if (isForbiddenError(error) || isNotFoundError(error)) {
      return <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />;
    }
    return (
      <ApiErrorState
        title="بارگذاری ناموفق"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  if (mode === "edit" && view?.system && !view.editable) {
    return (
      <PermissionDeniedState
        title="نقش سیستمی"
        description="این نقش سیستمی قابل ویرایش نیست."
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={mode === "create" ? "نقش سفارشی جدید" : `ویرایش ${view?.name ?? ""}`}
        description="ماتریس مجوزها فقط از کاتالوگ Backend ساخته می‌شود."
        breadcrumb={
          <AdminBreadcrumb
            pathname={mode === "create" ? routes.admin.roleNew : routes.admin.roleEdit(reference!)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.roles, label: "نقش‌ها" },
              { label: mode === "create" ? "جدید" : "ویرایش" },
            ]}
          />
        }
      />

      <form
        className="admin-access-form"
        onSubmit={(event) => {
          event.preventDefault();
          void prepareSave();
        }}
      >
        {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}
        {conflict ? (
          <Alert tone="warning" title="تداخل نسخه" description={adminAccessConflictMessage()} />
        ) : null}

        <FormField id="role-name" label="نام نقش" required>
          <Input
            id="role-name"
            value={active.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
          />
        </FormField>
        <FormField id="role-description" label="توضیح" optional>
          <Textarea
            id="role-description"
            rows={3}
            value={active.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </FormField>

        <section aria-labelledby="role-matrix-title" className="admin-access-form__matrix">
          <h2 id="role-matrix-title" className="text-card-title">
            ماتریس مجوزها
          </h2>
          {catalogQuery.isPending ? <AdminAccessDetailSkeleton /> : null}
          {catalogQuery.isError ? (
            <ApiErrorState
              title="کاتالوگ مجوزها در دسترس نیست"
              description={toAppApiError(catalogQuery.error).message}
              onRetry={() => void catalogQuery.refetch()}
            />
          ) : null}
          {!catalogQuery.isPending && !catalogQuery.isError && catalog.length === 0 ? (
            <EmptyState
              title="کاتالوگ خالی است"
              description="Backend هنوز کاتالوگ مجوزها را ارسال نکرده است. کلید مجوز اختراع نمی‌شود."
            />
          ) : null}
          {catalog.length > 0 ? (
            <AdminPermissionMatrix
              catalog={catalog}
              selectedKeys={active.permissionKeys}
              disabled={!canAssign}
              onChange={(next) => updateDraft({ permissionKeys: next })}
            />
          ) : null}
        </section>

        <div className="admin-access-form__actions">
          <Button type="submit" loading={submitting}>
            ذخیره
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const href =
                mode === "edit" && reference
                  ? routes.admin.roleDetail(reference)
                  : routes.admin.roles;
              if (!dirty) {
                router.push(href);
                return;
              }
              setPendingHref(href);
            }}
          >
            انصراف
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="خلاصه تغییرات مجوز"
        description={
          blockedReason ??
          (summary.length ? summary.join(" ") : "تغییرات نقش ذخیره می‌شود.")
        }
        confirmLabel="ذخیره"
        variant="primary"
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (blockedReason) return;
          void submitSave();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingHref)}
        title="تغییرات ذخیره نشده"
        description="تغییرات ذخیره‌نشده از بین می‌روند. ادامه می‌دهید؟"
        confirmLabel="خروج"
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          if (!pendingHref) return;
          const href = pendingHref;
          setPendingHref(null);
          setDraft(mode === "create" ? { name: "", description: "", permissionKeys: [] } : null);
          router.push(href);
        }}
      />
    </>
  );
}
