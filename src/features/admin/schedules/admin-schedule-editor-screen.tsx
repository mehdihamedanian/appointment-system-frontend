"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ApiErrorState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import type { BreadcrumbItem } from "@/components/layout/page-header";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Tabs, Tab, TabList, TabPanel } from "@/components/ui/tabs";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import { ScheduleBlockPanel } from "@/features/admin/schedules/schedule-block-panel";
import {
  scheduleEditorTitle,
  ScheduleEffectiveSummary,
} from "@/features/admin/schedules/schedule-effective-summary";
import { ScheduleInheritancePanel } from "@/features/admin/schedules/schedule-inheritance-panel";
import { ScheduleTimeOffPanel } from "@/features/admin/schedules/schedule-time-off-panel";
import { ScheduleWeeklyEditor } from "@/features/admin/schedules/schedule-weekly-editor";
import { useSession } from "@/features/auth/session-provider";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  validateWeeklyDraft,
  weeklyDraftEquals,
} from "@/lib/admin/schedule-adapter";
import { invalidateAfterAdminScheduleMutation } from "@/lib/admin/schedule-cache";
import {
  adminScheduleHubHref,
  schedulePermissionForScope,
  adminScheduleHref,
} from "@/lib/admin/schedule-filters";
import {
  adminScheduleDetailQueryOptions,
  createAdminScheduleBlock,
  createAdminScheduleTimeOff,
  deleteAdminScheduleBlock,
  deleteAdminScheduleTimeOff,
  previewAdminScheduleImpact,
  updateAdminScheduleWeekly,
} from "@/lib/api/admin-schedules";
import {
  isConflictError,
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBusiness } from "@/lib/api/public";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type {
  AdminScheduleImpactPreview,
  AdminScheduleInheritanceMode,
  AdminScheduleScope,
  AdminScheduleView,
  AdminScheduleWeekdayDraft,
} from "@/types/admin-schedule";
import { ADMIN_SCHEDULE_SCOPE_LABELS } from "@/types/admin-schedule";

type PendingSave =
  | { kind: "weekly"; inheritanceMode: AdminScheduleInheritanceMode; weekly: AdminScheduleWeekdayDraft[] }
  | { kind: "inheritance_switch"; nextMode: AdminScheduleInheritanceMode }
  | { kind: "time_off_create"; body: Record<string, unknown> }
  | { kind: "time_off_delete"; id: string }
  | { kind: "block_create"; body: Record<string, unknown> }
  | { kind: "block_delete"; id: string };

export function AdminScheduleEditorScreen({
  scope,
  reference,
}: {
  scope: AdminScheduleScope;
  reference?: string;
}) {
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="زمان‌بندی" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={schedulePermissionForScope(scope, "view")}>
      <AdminScheduleEditorReady userId={user!.id} user={user!} scope={scope} reference={reference} />
    </PermissionGate>
  );
}

function buildScheduleBreadcrumbs(
  scope: AdminScheduleScope,
  view: { scopeName?: string },
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { href: routes.admin.home, label: "پنل مدیریت" },
    { href: adminScheduleHubHref(), label: "زمان‌بندی" },
  ];
  if (scope === "business") {
    items.push({ label: "کسب‌وکار" });
  } else {
    items.push({
      href:
        scope === "branch"
          ? routes.admin.branches
          : scope === "staff"
            ? routes.admin.staff
            : routes.admin.resources,
      label: ADMIN_SCHEDULE_SCOPE_LABELS[scope],
    });
    if (view.scopeName) {
      items.push({ label: view.scopeName });
    }
  }
  return items;
}

function AdminScheduleEditorReady({
  userId,
  user,
  scope,
  reference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  scope: AdminScheduleScope;
  reference?: string;
}) {
  const query = useQuery(adminScheduleDetailQueryOptions(userId, scope, reference));
  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  const view = query.data;
  const timezone = view?.timezone ?? businessQuery.data?.timezone;

  if (query.isLoading) {
    return (
      <>
        <AdminPageHeader title="زمان‌بندی" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  if (query.isError) {
    const appError = toAppApiError(query.error);
    if (isForbiddenError(appError)) {
      return <ApiErrorState title="دسترسی محدود" description="مجوز مشاهده زمان‌بندی را ندارید." />;
    }
    if (isNotFoundError(appError)) {
      return (
        <>
          <ApiErrorState
            title="زمان‌بندی در دسترس نیست"
            description="سرویس زمان‌بندی هنوز به Backend متصل نشده یا این محدوده پیدا نشد."
          />
          <Button asChild variant="secondary">
            <Link href={adminScheduleHubHref()}>بازگشت به فهرست</Link>
          </Button>
        </>
      );
    }
    return <ApiErrorState title="خطا" description={appError.message} onRetry={() => void query.refetch()} />;
  }

  if (!view) return null;

  return (
    <AdminScheduleEditorForm
      key={`${view.version ?? "0"}:${view.updatedAt ?? ""}`}
      view={view}
      userId={userId}
      user={user}
      scope={scope}
      reference={reference}
      timezone={timezone}
      onReload={() => query.refetch()}
    />
  );
}

function AdminScheduleEditorForm({
  view,
  userId,
  user,
  scope,
  reference,
  timezone,
  onReload,
}: {
  view: AdminScheduleView;
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  scope: AdminScheduleScope;
  reference?: string;
  timezone?: string;
  onReload: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [inheritanceMode, setInheritanceMode] = useState(view.inheritanceMode);
  const [weeklyDraft, setWeeklyDraft] = useState(view.weekly);
  const baselineMode = view.inheritanceMode;
  const baselineWeekly = view.weekly;
  const [validationIssues, setValidationIssues] = useState<ReturnType<typeof validateWeeklyDraft>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deletingTimeOffId, setDeletingTimeOffId] = useState<string>();
  const [deletingBlockId, setDeletingBlockId] = useState<string>();
  const [impactPreview, setImpactPreview] = useState<AdminScheduleImpactPreview | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [inheritConfirmOpen, setInheritConfirmOpen] = useState(false);
  const [pendingInheritance, setPendingInheritance] = useState<AdminScheduleInheritanceMode | null>(null);

  const weeklyDirty =
    inheritanceMode !== baselineMode || !weeklyDraftEquals(weeklyDraft, baselineWeekly);
  useUnsavedChangesWarning(weeklyDirty && !submitting);

  const canEdit =
    view.allowedActions.edit === true ||
    (user.permissionCodes.length === 0 && scope !== "business") ||
    hasPermission(user, schedulePermissionForScope(scope, "edit"));

  const canManageWeekly =
    canEdit && view.allowedActions.manageWeekly !== false && inheritanceMode === "custom";

  const canManageTimeOff =
    canEdit &&
    view.allowedActions.manageTimeOff !== false &&
    (scope === "staff" || scope === "resource");

  const canManageBlocks = canEdit && view.allowedActions.manageBlocks !== false;

  const weeklyReadOnlyReason = view.weeklyReadOnlyReason;
  const dayRangeOnly = Boolean(weeklyReadOnlyReason);
  const withTimeZone = (body: Record<string, unknown>) =>
    dayRangeOnly ? { ...body, timeZone: timezone } : body;

  const breadcrumbs = buildScheduleBreadcrumbs(scope, view);

  const runImpactAndConfirm = useCallback(
    async (pending: PendingSave) => {
      if (!view) return;
      setImpactLoading(true);
      try {
        const action =
          pending.kind === "weekly" || pending.kind === "inheritance_switch"
            ? pending.kind === "inheritance_switch"
              ? "switch_inheritance"
              : "update_weekly"
            : pending.kind === "time_off_create"
              ? "create_time_off"
              : pending.kind === "time_off_delete"
                ? "delete_time_off"
                : pending.kind === "block_create"
                  ? "create_block"
                  : "delete_block";

        const body =
          pending.kind === "weekly"
            ? { inheritanceMode: pending.inheritanceMode, weekly: pending.weekly, version: view.version }
            : pending.kind === "inheritance_switch"
              ? { inheritanceMode: pending.nextMode, version: view.version }
              : pending.kind === "time_off_create"
                ? pending.body
                : pending.kind === "time_off_delete"
                  ? { timeOffId: pending.id, version: view.version }
                  : pending.kind === "block_create"
                    ? pending.body
                    : { blockId: pending.id, version: view.version };

        let preview: AdminScheduleImpactPreview;
        if (view.capabilities.supportsImpactPreview) {
          preview = await previewAdminScheduleImpact(scope, reference, action, body);
        } else {
          preview = {
            title: "تأیید تغییر",
            summary: "پیش‌نمایش تأثیر از Backend در دسترس نیست.",
            effects: [],
            requiresConfirmation: true,
          };
        }

        if (preview.blocked) {
          toast.error(preview.blockedReason ?? "این تغییر مجاز نیست.");
          return;
        }
        setPendingSave(pending);
        setImpactPreview(preview);
      } catch (error) {
        const appError = toAppApiError(error);
        if (isNotFoundError(appError)) {
          toast.error("پیش‌نمایش تأثیر هنوز به سرویس متصل نشده است.");
        } else if (isForbiddenError(appError)) {
          toast.error("دسترسی کافی برای این عملیات ندارید.");
        } else if (isSessionExpiredError(appError)) {
          toast.error("نشست منقضی شده است.");
        } else {
          toast.error(appError.message);
        }
      } finally {
        setImpactLoading(false);
      }
    },
    [reference, scope, toast, view],
  );

  async function confirmSave() {
    if (!view || !pendingSave) return;
    setSubmitting(true);
    const idempotencyKey = createIdempotencyKey();
    try {
      if (pendingSave.kind === "weekly" || pendingSave.kind === "inheritance_switch") {
        await updateAdminScheduleWeekly(
          scope,
          reference,
          {
            inheritanceMode:
              pendingSave.kind === "inheritance_switch"
                ? pendingSave.nextMode
                : pendingSave.inheritanceMode,
            weekly:
              pendingSave.kind === "inheritance_switch" ? baselineWeekly : pendingSave.weekly,
            version: view.version,
          },
          idempotencyKey,
          impactPreview?.previewVersion,
        );
      } else if (pendingSave.kind === "time_off_create") {
        await createAdminScheduleTimeOff(
          scope,
          reference,
          pendingSave.body,
          idempotencyKey,
          impactPreview?.previewVersion,
        );
      } else if (pendingSave.kind === "time_off_delete") {
        await deleteAdminScheduleTimeOff(
          scope,
          reference,
          pendingSave.id,
          idempotencyKey,
          impactPreview?.previewVersion,
        );
      } else if (pendingSave.kind === "block_create") {
        await createAdminScheduleBlock(
          scope,
          reference,
          pendingSave.body,
          idempotencyKey,
          impactPreview?.previewVersion,
        );
      } else if (pendingSave.kind === "block_delete") {
        await deleteAdminScheduleBlock(
          scope,
          reference,
          pendingSave.id,
          idempotencyKey,
          impactPreview?.previewVersion,
        );
      }

      invalidateAfterAdminScheduleMutation(queryClient, userId, scope, reference);
      await onReload();
      toast.success("تغییرات ذخیره شد.");
      setImpactPreview(null);
      setPendingSave(null);
    } catch (error) {
      const appError = toAppApiError(error);
      if (isConflictError(appError) && !dayRangeOnly) {
        toast.error("نسخه تغییر کرده — داده تازه بارگذاری شد.");
        await onReload();
      } else {
        toast.error(appError.message);
      }
    } finally {
      setSubmitting(false);
      setDeletingTimeOffId(undefined);
      setDeletingBlockId(undefined);
    }
  }

  function requestWeeklySave() {
    const issues = validateWeeklyDraft(weeklyDraft, {
      supportsOvernightIntervals: view.capabilities.supportsOvernightIntervals,
      supportsBreaks: view.capabilities.supportsBreaks,
    });
    setValidationIssues(issues);
    if (issues.length > 0) {
      toast.error("خطاهای اعتبارسنجی را برطرف کنید.");
      return;
    }
    void runImpactAndConfirm({ kind: "weekly", inheritanceMode, weekly: weeklyDraft });
  }

  function handleInheritanceChange(next: AdminScheduleInheritanceMode) {
    if (next === inheritanceMode) return;
    if (inheritanceMode === "custom" && next !== "custom" && weeklyDirty) {
      setPendingInheritance(next);
      setInheritConfirmOpen(true);
      return;
    }
    setInheritanceMode(next);
    if (next !== "custom" && baselineMode !== next) {
      void runImpactAndConfirm({ kind: "inheritance_switch", nextMode: next });
    }
  }

  const impactDescription = impactPreview
    ? [
        impactPreview.summary,
        ...(impactPreview.effects.length ? [impactPreview.effects.join(" • ")] : []),
        ...(typeof impactPreview.futureAppointmentCount === "number"
          ? [`نوبت‌های آینده تحت تأثیر: ${impactPreview.futureAppointmentCount}`]
          : []),
        ...(impactPreview.availabilityAffected ? ["دسترس‌پذیری رزرو تحت تأثیر قرار می‌گیرد."] : []),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const title = scheduleEditorTitle(view);

  return (
    <>
      <AdminBreadcrumb pathname={adminScheduleHref(scope, reference)} items={breadcrumbs} />
      <AdminPageHeader
        title={title}
        description={`مدیریت ساعات کاری، استراحت، مرخصی و مسدودی — ${ADMIN_SCHEDULE_SCOPE_LABELS[scope]}`}
        secondaryActions={
          view.calendarHref && view.allowedActions.viewCalendar !== false ? (
            <Button asChild variant="secondary">
              <Link href={view.calendarHref}>مشاهده در تقویم</Link>
            </Button>
          ) : null
        }
      />

      {timezone ? <p className="ds-help">منطقه زمانی کسب‌وکار: <span className="ltr-value">{timezone}</span></p> : null}

      <Tabs defaultValue="weekly">
        <TabList>
          <Tab value="weekly">هفتگی</Tab>
          <Tab value="timeoff" disabled={!canManageTimeOff}>
            مرخصی
          </Tab>
          <Tab value="blocks" disabled={!canManageBlocks}>
            مسدودی
          </Tab>
        </TabList>

        <TabPanel value="weekly">
          <div className="admin-schedule-editor">
            {weeklyReadOnlyReason ? (
              <Alert tone="info" title="ساعات هفتگی (فقط نمایش)" description={weeklyReadOnlyReason} />
            ) : (
              <ScheduleInheritancePanel
                scope={scope}
                mode={inheritanceMode}
                disabled={!canEdit || submitting}
                onChange={handleInheritanceChange}
              />
            )}
            {weeklyReadOnlyReason ? null : inheritanceMode === "custom" ? (
              <>
                <ScheduleWeeklyEditor
                  weekly={weeklyDraft}
                  disabled={!canManageWeekly || submitting}
                  supportsBreaks={view.capabilities.supportsBreaks}
                  supportsCopyDay={view.capabilities.supportsCopyDay}
                  issues={validationIssues}
                  onChange={setWeeklyDraft}
                />
                {canManageWeekly ? (
                  <div className="admin-schedule-actions">
                    <Button type="button" loading={submitting || impactLoading} onClick={requestWeeklySave}>
                      ذخیره ساعات هفتگی
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <Alert
                tone="info"
                title="حالت وراثت"
                description="ویرایش هفتگی غیرفعال است. Backend برنامه مؤثر را از منبع والد محاسبه می‌کند."
              />
            )}
            <ScheduleEffectiveSummary
              effective={view.effective}
              overrideSemanticsLabel={
                view.capabilities.overrideSemanticsLabel ??
                (view.capabilities.overrideSemantics === "replace"
                  ? "جایگزینی کامل برنامه هفتگی"
                  : view.capabilities.overrideSemantics === "merge"
                    ? "ادغام با برنامه هفتگی"
                    : undefined)
              }
            />
          </div>
        </TabPanel>

        <TabPanel value="timeoff">
          <ScheduleTimeOffPanel
            items={view.timeOff}
            disabled={!canManageTimeOff || submitting}
            deletingId={deletingTimeOffId}
            dayRangeOnly={dayRangeOnly}
            timeZone={timezone}
            onCreate={(body) =>
              void runImpactAndConfirm({ kind: "time_off_create", body: withTimeZone(body) })
            }
            onDelete={(id) => {
              setDeletingTimeOffId(id);
              void runImpactAndConfirm({ kind: "time_off_delete", id });
            }}
          />
        </TabPanel>

        <TabPanel value="blocks">
          <ScheduleBlockPanel
            items={view.blocks}
            scope={scope}
            disabled={!canManageBlocks || submitting}
            deletingId={deletingBlockId}
            dayRangeOnly={dayRangeOnly}
            timeZone={timezone}
            onCreate={(body) =>
              void runImpactAndConfirm({ kind: "block_create", body: withTimeZone(body) })
            }
            onDelete={(id) => {
              setDeletingBlockId(id);
              void runImpactAndConfirm({ kind: "block_delete", id });
            }}
          />
        </TabPanel>
      </Tabs>

      <ConfirmDialog
        open={inheritConfirmOpen}
        title="تغییر به حالت وراثت"
        description="با تغییر از سفارشی به وراثت، داده سفارشی ممکن است غیرفعال یا حذف شود (طبق Backend). ادامه می‌دهید؟"
        confirmLabel="ادامه"
        cancelLabel="انصراف"
        onCancel={() => {
          setInheritConfirmOpen(false);
          setPendingInheritance(null);
        }}
        onConfirm={() => {
          if (pendingInheritance) {
            setInheritanceMode(pendingInheritance);
            void runImpactAndConfirm({ kind: "inheritance_switch", nextMode: pendingInheritance });
          }
          setInheritConfirmOpen(false);
          setPendingInheritance(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(impactPreview && pendingSave)}
        title={impactPreview?.title ?? "تأیید تغییر"}
        description={impactDescription || "تغییرات ذخیره شود؟"}
        confirmLabel={impactPreview?.confirmLabel ?? "ذخیره"}
        cancelLabel="انصراف"
        variant="primary"
        busy={submitting}
        onCancel={() => {
          setImpactPreview(null);
          setPendingSave(null);
          setDeletingTimeOffId(undefined);
          setDeletingBlockId(undefined);
        }}
        onConfirm={() => void confirmSave()}
      />
    </>
  );
}

export function AdminScheduleBusinessScreen() {
  return <AdminScheduleEditorScreen scope="business" />;
}

export function AdminScheduleBranchScreen({ branchReference }: { branchReference: string }) {
  return <AdminScheduleEditorScreen scope="branch" reference={branchReference} />;
}

export function AdminScheduleStaffScreen({ staffReference }: { staffReference: string }) {
  return <AdminScheduleEditorScreen scope="staff" reference={staffReference} />;
}

export function AdminScheduleResourceScreen({ resourceReference }: { resourceReference: string }) {
  return <AdminScheduleEditorScreen scope="resource" reference={resourceReference} />;
}
