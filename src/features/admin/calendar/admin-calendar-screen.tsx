"use client";

import { useCallback, useMemo, useState, useTransition, lazy, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { AdminCalendarAgenda } from "@/features/admin/calendar/admin-calendar-agenda";
import { AdminCalendarFiltersDrawer } from "@/features/admin/calendar/admin-calendar-filters";
import { AdminCalendarQuickView } from "@/features/admin/calendar/admin-calendar-quick-view";
import { AdminCalendarToolbar } from "@/features/admin/calendar/admin-calendar-toolbar";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminCalendarQueryOptions } from "@/lib/api/admin-calendar";
import {
  adminCalendarFiltersApplied,
  adminCalendarHref,
  applyBranchChange,
  clearAdminCalendarFilters,
  countActiveAdminCalendarFilters,
  parseAdminCalendarState,
} from "@/lib/admin/calendar-filters";
import {
  eachIsoDateInclusive,
  navigateCalendarDate,
  visibleRangeFor,
} from "@/lib/admin/calendar-range";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBusiness } from "@/lib/api/public";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import { ADMIN_CALENDAR_DRAG_DROP_ENABLED } from "@/types/admin-calendar";
import type {
  AdminCalendarEventView,
  AdminCalendarState,
} from "@/types/admin-calendar";

const AdminCalendarTimeGrid = lazy(() =>
  import("@/features/admin/calendar/admin-calendar-time-grid").then((m) => ({
    default: m.AdminCalendarTimeGrid,
  })),
);
const AdminCalendarMonthView = lazy(() =>
  import("@/features/admin/calendar/admin-calendar-month-view").then((m) => ({
    default: m.AdminCalendarMonthView,
  })),
);

export function AdminCalendarScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader
          title="تقویم عملیاتی"
          description="نوبت‌ها، زمان‌های مسدود و مرخصی کارکنان."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.calendar}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "تقویم" },
              ]}
            />
          }
        />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.calendar.view">
      <AdminCalendarScreenReady userId={user.id} user={user} />
    </PermissionGate>
  );
}

function AdminCalendarScreenReady({
  userId,
  user,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickEvent, setQuickEvent] = useState<AdminCalendarEventView | null>(null);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  const timezone = businessQuery.data?.timezone;
  const state = useMemo(
    () => parseAdminCalendarState(searchParams, timezone),
    [searchParams, timezone],
  );

  const canViewResources =
    hasPermission(user, "admin.resources.view") || user.permissionCodes.length === 0;
  const canViewBlockReason =
    hasPermission(user, "admin.calendar.view_blocks") || user.permissionCodes.length === 0;
  const showQuickAdd =
    hasPermission(user, "admin.appointments.create") || user.permissionCodes.length === 0;
  const capabilities = getBusinessCapabilities();
  const showBranch =
    isCapabilityVisible(capabilities, "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true;

  const calendarQuery = useQuery({
    ...adminCalendarQueryOptions(userId, state, {
      timezone,
      canViewBlockReason,
    }),
  });

  const weekStartsOn = calendarQuery.data?.weekStartsOn ?? 6;
  const view = calendarQuery.data;
  const activeFilterCount = countActiveAdminCalendarFilters(state);
  const filtersApplied = adminCalendarFiltersApplied(state);

  const replaceState = useCallback(
    (next: Partial<AdminCalendarState>) => {
      const merged: AdminCalendarState = { ...state, ...next };
      startTransition(() => {
        router.replace(adminCalendarHref(merged), { scroll: false });
      });
    },
    [router, startTransition, state],
  );

  const resolvedQuickEvent = useMemo(() => {
    if (quickEvent) return quickEvent;
    if (!state.event || !view) return null;
    return (
      view.events.find((e) => e.appointmentReference === state.event || e.id === state.event) ??
      null
    );
  }, [quickEvent, state.event, view]);

  function openEvent(event: AdminCalendarEventView) {
    setQuickEvent(event);
    if (event.appointmentReference) {
      replaceState({ event: event.appointmentReference });
    }
  }

  function closeQuickView() {
    setQuickEvent(null);
    replaceState({ event: undefined });
  }

  const rangeDates = useMemo(() => {
    const { from, to } = visibleRangeFor(state.date, state.range, weekStartsOn);
    if (state.range === "day") return [state.date];
    if (state.range === "week") return eachIsoDateInclusive(from, to);
    return [];
  }, [state.date, state.range, weekStartsOn]);

  const announcement = `${state.range} · ${state.grouping} · ${state.date}`;

  if (calendarQuery.isError) {
    const error = toAppApiError(calendarQuery.error);
    if (isForbiddenError(error)) {
      return <PermissionDeniedState description="مجوز مشاهده تقویم را ندارید." />;
    }
    if (isSessionExpiredError(error)) {
      return (
        <ApiErrorState
          title="نشست منقضی شده"
          description={error.message}
          onRetry={() => router.push(routes.auth.sessionExpired)}
        />
      );
    }
  }

  return (
    <>
      <AdminPageHeader
        title="تقویم عملیاتی"
        description="نوبت‌ها، زمان‌های مسدود و مرخصی — بدون کشیدن و رها کردن در این فاز."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.calendar}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "تقویم" },
            ]}
          />
        }
      />

      <div
        className="admin-calendar"
        data-dnd={ADMIN_CALENDAR_DRAG_DROP_ENABLED ? "enabled" : "disabled"}
      >
        <AdminCalendarToolbar
          state={state}
          timezone={view?.timezone ?? timezone}
          lastUpdatedAt={view?.lastUpdatedAt}
          refreshing={calendarQuery.isFetching && !calendarQuery.isPending}
          activeFilterCount={activeFilterCount}
          showQuickAdd={showQuickAdd}
          onNavigate={(dir) => {
            replaceState({
              date: navigateCalendarDate(state.date, state.range, dir, timezone),
              event: undefined,
            });
          }}
          onRangeChange={(range) => replaceState({ range, event: undefined })}
          onGroupingChange={(grouping) => replaceState({ grouping, event: undefined })}
          onPresentationChange={(presentation) => replaceState({ presentation })}
          onDateChange={(date) => replaceState({ date, event: undefined })}
          onRefresh={() => void calendarQuery.refetch()}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>

        {view?.partialErrors?.blockedTime ? (
          <Alert
            tone="warning"
            title="زمان‌های مسدود کامل دریافت نشد"
            description={view.partialErrors.blockedTime.message}
          />
        ) : null}
        {view?.partialErrors?.timeOff ? (
          <Alert
            tone="warning"
            title="مرخصی‌ها کامل دریافت نشد"
            description={view.partialErrors.timeOff.message}
          />
        ) : null}

        {calendarQuery.isPending ? (
          <div className="admin-calendar__loading">
            <InlineLoading label="در حال بارگذاری تقویم" />
            <Skeleton variant="card" />
          </div>
        ) : null}

        {calendarQuery.isError ? (
          <ApiErrorState
            title={
              isNotFoundError(toAppApiError(calendarQuery.error))
                ? "تقویم عملیاتی هنوز متصل نشده"
                : "تقویم بارگذاری نشد"
            }
            description={
              isNotFoundError(toAppApiError(calendarQuery.error))
                ? "Backend باید GET /admin/calendar را برای بازهٔ مرئی ارائه کند. جزئیات در BACKEND_DEPENDENCIES.md است."
                : toAppApiError(calendarQuery.error).message
            }
            requestId={toAppApiError(calendarQuery.error).requestId}
            onRetry={() => void calendarQuery.refetch()}
          />
        ) : null}

        {view ? (
          <>
            {view.noColumnsConfigured ? (
              <EmptyState
                title="کارمند یا منبعی پیکربندی نشده"
                description="برای گروه‌بندی کارکنان یا منابع، ابتدا آن‌ها را در پنل تعریف کنید."
              />
            ) : null}

            {view.events.length === 0 && !view.noColumnsConfigured ? (
              filtersApplied || view.filtersApplied ? (
                <NoResultsState
                  title="نتیجه‌ای با این فیلترها نیست"
                  description="فیلترها را تغییر دهید یا پاک کنید. شبکهٔ تقویم همچنان قابل ناوبری است."
                />
              ) : (
                <p className="ds-help admin-calendar__empty-hint" role="status">
                  در این بازه نوبتی ثبت نشده است.
                </p>
              )
            ) : null}

            <div className="admin-calendar__desktop">
              {state.presentation === "agenda" ? (
                <AdminCalendarAgenda view={view} onActivate={openEvent} />
              ) : state.range === "month" ? (
                <Suspense fallback={<InlineLoading label="بارگذاری ماه" />}>
                  <AdminCalendarMonthView
                    view={view}
                    anchorDate={state.date}
                    weekStartsOn={weekStartsOn}
                    onSelectDay={(date) => replaceState({ date, range: "day", event: undefined })}
                  />
                </Suspense>
              ) : (
                <Suspense fallback={<InlineLoading label="بارگذاری شبکه" />}>
                  <AdminCalendarTimeGrid
                    view={view}
                    dates={rangeDates}
                    columns={view.columns}
                    onActivate={openEvent}
                    showNowLine={state.range === "day" || state.range === "week"}
                  />
                </Suspense>
              )}
            </div>

            <div className="admin-calendar__mobile">
              {state.presentation === "grid" && state.range === "day" ? (
                <Suspense fallback={<InlineLoading label="بارگذاری روز" />}>
                  <AdminCalendarTimeGrid
                    view={view}
                    dates={[state.date]}
                    columns={view.columns.slice(0, 3)}
                    onActivate={openEvent}
                    showNowLine
                  />
                </Suspense>
              ) : (
                <AdminCalendarAgenda view={view} onActivate={openEvent} />
              )}
            </div>
          </>
        ) : null}
      </div>

      <AdminCalendarFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        state={state}
        options={view?.filterOptions}
        showBranch={showBranch}
        showResources={canViewResources}
        onChange={(patch) => {
          if ("branchId" in patch) {
            replaceState(applyBranchChange({ ...state, ...patch }, patch.branchId));
            return;
          }
          replaceState(patch);
        }}
        onClear={() => replaceState(clearAdminCalendarFilters(state))}
      />

      <AdminCalendarQuickView
        event={resolvedQuickEvent}
        open={Boolean(resolvedQuickEvent)}
        onClose={closeQuickView}
        onRefreshCalendar={() => void calendarQuery.refetch()}
      />
    </>
  );
}
