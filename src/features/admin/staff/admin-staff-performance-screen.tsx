"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminStaffDetailQueryOptions,
  adminStaffPerformanceQueryOptions,
} from "@/lib/api/admin-staff";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";

export function AdminStaffPerformanceScreen() {
  const { status, user } = useSession();
  const params = useParams<{ staffReference: string }>();
  const reference = decodeURIComponent(params.staffReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="عملکرد کارمند" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.staff.view_performance">
      <AdminStaffPerformanceReady userId={user.id} reference={reference} />
    </PermissionGate>
  );
}

function AdminStaffPerformanceReady({
  userId,
  reference,
}: {
  userId: string;
  reference: string;
}) {
  const detailQuery = useQuery(adminStaffDetailQueryOptions(userId, reference));
  const performanceQuery = useQuery({
    ...adminStaffPerformanceQueryOptions(userId, reference),
    enabled:
      Boolean(detailQuery.data?.capabilities.hasPerformance) &&
      detailQuery.data?.allowedActions.viewPerformance !== false,
  });

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="عملکرد" />
        <InlineLoading label="بارگذاری" />
      </>
    );
  }

  const staff = detailQuery.data;
  if (!staff?.capabilities.hasPerformance || staff.allowedActions.viewPerformance === false) {
    return (
      <EmptyState
        title="گزارش عملکرد در دسترس نیست"
        description="Backend یا مجوز `admin.staff.view_performance` این بخش را فعال نکرده است."
        action={
          <Button asChild variant="secondary">
            <Link href={routes.admin.staffDetail(reference)}>بازگشت</Link>
          </Button>
        }
      />
    );
  }

  if (performanceQuery.isPending) {
    return (
      <>
        <AdminPageHeader title={`عملکرد ${staff.name}`} />
        <InlineLoading label="بارگذاری گزارش" />
      </>
    );
  }

  if (performanceQuery.isError) {
    const error = toAppApiError(performanceQuery.error);
    if (isForbiddenError(error)) {
      return <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="گزارش عملکرد یافت نشد"
          description="Backend باید GET /admin/staff/{reference}/performance را ارائه کند."
        />
      );
    }
    return (
      <ApiErrorState
        title="گزارش عملکرد بارگذاری نشد"
        description={error.message}
        onRetry={() => void performanceQuery.refetch()}
      />
    );
  }

  const perf = performanceQuery.data;
  if (!perf) return null;

  return (
    <>
      <AdminPageHeader
        title={`عملکرد ${staff.name}`}
        description={perf.periodLabel ?? "داده‌های محاسبه‌شده توسط Backend"}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.staffPerformance(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.staff, label: "کارکنان" },
              { href: routes.admin.staffDetail(reference), label: staff.name },
              { label: "عملکرد" },
            ]}
          />
        }
      />

      <section className="admin-staff-performance" aria-labelledby="staff-performance-title">
        <h2 id="staff-performance-title" className="visually-hidden">
          شاخص‌های عملکرد
        </h2>
        <dl className="booking-summary">
          {typeof perf.appointmentCount === "number" ? (
            <div>
              <dt>تعداد نوبت</dt>
              <dd className="ltr-value">{perf.appointmentCount}</dd>
            </div>
          ) : null}
          {typeof perf.completedCount === "number" ? (
            <div>
              <dt>تکمیل‌شده</dt>
              <dd className="ltr-value">{perf.completedCount}</dd>
            </div>
          ) : null}
          {typeof perf.cancelledCount === "number" ? (
            <div>
              <dt>لغوشده</dt>
              <dd className="ltr-value">{perf.cancelledCount}</dd>
            </div>
          ) : null}
          {typeof perf.noShowCount === "number" ? (
            <div>
              <dt>عدم حضور</dt>
              <dd className="ltr-value">{perf.noShowCount}</dd>
            </div>
          ) : null}
          {perf.utilizationLabel ? (
            <div>
              <dt>بهره‌وری</dt>
              <dd>{perf.utilizationLabel}</dd>
            </div>
          ) : null}
          {perf.revenueLabel ? (
            <div>
              <dt>درآمد</dt>
              <dd>{perf.revenueLabel}</dd>
            </div>
          ) : null}
        </dl>
        {perf.metrics.length > 0 ? (
          <ul className="admin-staff-performance__metrics">
            {perf.metrics.map((metric) => (
              <li key={metric.label}>
                <span>{metric.label}</span>
                <span className="ltr-value">{metric.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="ds-help">همه مقادیر از Backend محاسبه می‌شوند؛ UI هیچ محاسبه‌ای انجام نمی‌دهد.</p>
      </section>
    </>
  );
}
