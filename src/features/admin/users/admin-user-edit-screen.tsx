"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/selection";
import { useToast } from "@/components/feedback/toast";
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { AdminAccessDetailSkeleton } from "@/features/admin/access/admin-access-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminAccessConflictMessage,
  isAdminAccessConflict,
} from "@/lib/admin/access-adapter";
import {
  invalidateAfterAdminUserMutation,
  refreshSessionAfterAccessChange,
} from "@/lib/admin/access-cache";
import { accessPermission, defaultAdminRoleFilters } from "@/lib/admin/access-filters";
import {
  adminRoleListQueryOptions,
  adminUserDetailQueryOptions,
  fetchAdminUserImpactPreview,
  updateAdminUser,
} from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { routes } from "@/constants/routes";
import type { AdminUserDetailView } from "@/types/admin-access";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type UserEditDraft = {
  displayName: string;
  roleReference: string;
  staffReference: string;
  unlinkStaff: boolean;
  branchScopeIds: string[];
};

function baselineFromView(view: AdminUserDetailView): UserEditDraft {
  return {
    displayName: view.displayName,
    roleReference: view.roleReference ?? "",
    staffReference: view.staffReference ?? "",
    unlinkStaff: false,
    branchScopeIds: view.branchScopeIds,
  };
}

export function AdminUserEditScreen() {
  const params = useParams<{ userReference: string }>();
  const { status, user, refetch } = useSession();
  const reference = params.userReference;

  if (status === "loading" || !user?.id || !reference) {
    return <AdminAccessDetailSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("usersEdit")}>
      <AdminAccessGate>
        <AdminUserEditForm
          sessionUserId={user.id}
          reference={reference}
          onSessionRefresh={() => void refetch()}
        />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminUserEditForm({
  sessionUserId,
  reference,
  onSessionRefresh,
}: {
  sessionUserId: string;
  reference: string;
  onSessionRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const detailQuery = useQuery(adminUserDetailQueryOptions(sessionUserId, reference));
  const rolesQuery = useQuery(adminRoleListQueryOptions(sessionUserId, defaultAdminRoleFilters()));

  const view = detailQuery.data;
  const [draft, setDraft] = useState<UserEditDraft | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const [previewVersion, setPreviewVersion] = useState<string | undefined>();
  const [blockedReason, setBlockedReason] = useState<string | undefined>();

  const active = draft ?? (view ? baselineFromView(view) : null);
  const dirty = draft !== null;
  useUnsavedChangesWarning(dirty);

  function updateDraft(patch: Partial<UserEditDraft>) {
    setDraft((current) => {
      const base = current ?? (view ? baselineFromView(view) : null);
      if (!base) return current;
      return { ...base, ...patch };
    });
  }

  function requestLeave(href: string) {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingHref(href);
  }

  const roleOptions = useMemo(
    () =>
      (rolesQuery.data?.items ?? []).map((role) => ({
        value: role.reference,
        label: role.name,
      })),
    [rolesQuery.data?.items],
  );

  const error = detailQuery.isError ? toAppApiError(detailQuery.error) : undefined;

  async function prepareSave() {
    if (!active) return;
    setBlockedReason(undefined);
    setConflict(false);
    try {
      const preview = await fetchAdminUserImpactPreview(reference, {
        roleReference: active.roleReference || undefined,
        branchScopeIds: active.branchScopeIds,
        staffReference: active.unlinkStaff ? null : active.staffReference || undefined,
        displayName: active.displayName,
      });
      const lines = [...preview.summaryLines];
      if (preview.grantedPermissions.length) {
        lines.push(`مجوزهای افزوده‌شده: ${preview.grantedPermissions.length}`);
      }
      if (preview.revokedPermissions.length) {
        lines.push(`مجوزهای حذف‌شده: ${preview.revokedPermissions.length}`);
      }
      setSummary(lines);
      setPreviewVersion(preview.previewVersion);
      if (preview.blocked) {
        setBlockedReason(preview.blockedReason ?? "این تغییر مجاز نیست.");
      }
      setConfirmOpen(true);
    } catch {
      const lines = ["تغییرات نقش، محدوده شعبه یا پیوند پرسنل اعمال می‌شود."];
      if (view?.isCurrentUser) {
        lines.push("این تغییر ممکن است روی نشست فعلی شما اثر بگذارد.");
      }
      setSummary(lines);
      setPreviewVersion(undefined);
      setConfirmOpen(true);
    }
  }

  async function submitSave() {
    if (blockedReason || !active) return;
    setSubmitting(true);
    try {
      void previewVersion;
      await updateAdminUser(
        reference,
        {
          displayName: active.displayName,
          roleReference: active.roleReference || undefined,
          branchScopeIds: view?.branchScopeSupported ? active.branchScopeIds : undefined,
          staffReference: active.unlinkStaff ? null : active.staffReference || undefined,
          version: view?.version,
        },
        newIdempotencyKey(),
      );
      invalidateAfterAdminUserMutation(queryClient, sessionUserId, reference);
      const affectedCurrentUser = view?.isCurrentUser === true;
      await refreshSessionAfterAccessChange(queryClient, sessionUserId, {
        affectedCurrentUser,
      });
      if (affectedCurrentUser) onSessionRefresh();
      setDraft(null);
      setConfirmOpen(false);
      toast.success("کاربر به‌روزرسانی شد");
      router.replace(routes.admin.userDetail(reference));
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
      toast.error(appError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (detailQuery.isPending) return <AdminAccessDetailSkeleton />;

  if (error) {
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

  if (!view || !active) return null;

  if (view.allowedActions.edit !== true && view.allowedActions.assignRole !== true) {
    return (
      <PermissionDeniedState
        title="ویرایش مجاز نیست"
        description={view.allowedActions.blockedReason ?? "مجوز ویرایش این کاربر را ندارید."}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`ویرایش ${view.displayName}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.userEdit(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.users, label: "کاربران" },
              { href: routes.admin.userDetail(reference), label: view.displayName },
              { label: "ویرایش" },
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
        {conflict ? (
          <Alert tone="warning" title="تداخل نسخه" description={adminAccessConflictMessage()} />
        ) : null}
        {view.isCurrentUser ? (
          <Alert
            tone="warning"
            title="ویرایش خود"
            description="کاهش نقش یا محدوده ممکن است دسترسی فعلی شما را قطع کند."
          />
        ) : null}

        <FormField id="user-display-name" label="نام نمایشی" required>
          <Input
            id="user-display-name"
            value={active.displayName}
            onChange={(event) => updateDraft({ displayName: event.target.value })}
          />
        </FormField>

        <FormField id="user-role" label="نقش" required>
          <Select
            id="user-role"
            value={active.roleReference || undefined}
            options={roleOptions}
            onChange={(value) => updateDraft({ roleReference: value ?? "" })}
            allowClear={false}
          />
        </FormField>

        <FormField
          id="user-staff"
          label="مرجع پرسنل پیوندی"
          optional
          description="پیوند یا لغو پیوند پرسنل، کتابی/قابل‌مشاهده بودن پرسنل را تغییر نمی‌دهد مگر Backend صراحتاً تعریف کند."
        >
          <Input
            id="user-staff"
            className="ltr-value"
            value={active.staffReference}
            disabled={active.unlinkStaff}
            onChange={(event) => updateDraft({ staffReference: event.target.value })}
          />
        </FormField>
        {view.staffReference ? (
          <Checkbox
            label="لغو پیوند پرسنل"
            checked={active.unlinkStaff}
            onChange={(event) => updateDraft({ unlinkStaff: event.target.checked })}
          />
        ) : null}

        {view.branchScopeSupported ? (
          <FormField
            id="user-branches"
            label="محدوده شعبه"
            description="محدوده شعبه جدا از مجموعه مجوزهاست."
          >
            <Input
              id="user-branches"
              className="ltr-value"
              value={active.branchScopeIds.join(",")}
              placeholder="branch_1,branch_2"
              onChange={(event) =>
                updateDraft({
                  branchScopeIds: event.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean),
                })
              }
            />
          </FormField>
        ) : null}

        <div className="admin-access-form__actions">
          <Button type="submit" loading={submitting}>
            ذخیره
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => requestLeave(routes.admin.userDetail(reference))}
          >
            انصراف
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="تأیید تغییرات کاربر"
        description={
          blockedReason ??
          (summary.length ? summary.join(" ") : "تغییرات نقش/محدوده اعمال می‌شود.")
        }
        confirmLabel="اعمال"
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
          setDraft(null);
          router.push(href);
        }}
      />
    </>
  );
}
