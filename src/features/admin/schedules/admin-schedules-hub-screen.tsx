"use client";

import Link from "next/link";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ApiErrorState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminScheduleBusinessHref,
  adminScheduleHolidaysHref,
} from "@/lib/admin/schedule-filters";
import { routes } from "@/constants/routes";
import { ADMIN_SCHEDULE_EDITOR_ENABLED } from "@/types/admin-schedule";

export function AdminSchedulesHubScreen() {
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (!ADMIN_SCHEDULE_EDITOR_ENABLED) {
    return (
      <ApiErrorState
        title="زمان‌بندی"
        description="ویرایشگر زمان‌بندی هنوز فعال نشده است."
      />
    );
  }

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="زمان‌بندی" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.schedules.business.view">
      <AdminSchedulesHubReady />
    </PermissionGate>
  );
}

function AdminSchedulesHubReady() {
  return (
    <>
      <AdminBreadcrumb pathname={routes.admin.schedules} />
      <AdminPageHeader
        title="زمان‌بندی"
        description="مدیریت یکپارچه ساعات کاری، تعطیلات، مرخصی و مسدودی برای همه سطوح."
      />

      <div className="admin-schedule-hub">
        <section className="admin-schedule-hub__card">
          <h2 className="text-card-title">سطوح زمان‌بندی</h2>
          <ul className="admin-schedule-hub__links">
            <li>
              <Link href={adminScheduleBusinessHref()}>ساعات کسب‌وکار</Link>
            </li>
            <li>
              <Link href={routes.admin.branches}>ساعات شعب (از جزئیات شعبه)</Link>
            </li>
            <li>
              <Link href={routes.admin.staff}>ساعات کارکنان (از جزئیات کارمند)</Link>
            </li>
            <li>
              <Link href={routes.admin.resources}>ساعات منابع (از جزئیات منبع)</Link>
            </li>
          </ul>
        </section>

        <section className="admin-schedule-hub__card">
          <h2 className="text-card-title">تعطیلات و روزهای ویژه</h2>
          <p className="ds-help">
            تعطیلات رسمی و روزهای با ساعات غیرمعمول — معنای جایگزینی/ادغام از Backend
            خوانده می‌شود.
          </p>
          <Button asChild variant="secondary">
            <Link href={adminScheduleHolidaysHref()}>مدیریت تعطیلات</Link>
          </Button>
        </section>

        <section className="admin-schedule-hub__card">
          <h2 className="text-card-title">تقویم</h2>
          <p className="ds-help">
            نمایش ساعات کاری، استراحت، مرخصی و مسدودی در تقویم مدیریت (فاز ۲۷).
          </p>
          <Button asChild variant="secondary">
            <Link href={routes.admin.calendar}>باز کردن تقویم</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
