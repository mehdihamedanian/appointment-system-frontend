"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { EmptyState } from "@/components/feedback/app-states";
import { PermissionGate } from "@/features/admin/permission-gate";
import { routes } from "@/constants/routes";
import { ADMIN_APPOINTMENT_RESCHEDULE_ENABLED } from "@/types/admin-appointment";
import { isSafePublicId } from "@/lib/public/booking-href";

export function AdminAppointmentRescheduleScreen({ reference }: { reference: string }) {
  const safe = isSafePublicId(reference) ? reference : "";

  return (
    <PermissionGate permission="admin.appointments.view">
      <AdminPageHeader
        title="تغییر زمان نوبت"
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.appointmentReschedule(safe)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.appointments, label: "نوبت‌ها" },
              { href: routes.admin.appointmentDetail(safe), label: "جزئیات" },
              { label: "تغییر زمان" },
            ]}
          />
        }
        secondaryActions={
          <Link href={routes.admin.appointmentDetail(safe)} className="btn btn--ghost btn--sm">
            <ArrowRight className="icon-dir" size={16} aria-hidden="true" />
            بازگشت
          </Link>
        }
      />
      {ADMIN_APPOINTMENT_RESCHEDULE_ENABLED ? (
        <p className="text-caption">جریان تغییر زمان مدیریتی پس از اتصال API تکمیل می‌شود.</p>
      ) : (
        <EmptyState
          title="تغییر زمان مدیریتی در دسترس نیست"
          description="Backend هنوز قرارداد admin reschedule را ارائه نکرده است. جزئیات در BACKEND_DEPENDENCIES.md ثبت شده است."
        />
      )}
    </PermissionGate>
  );
}
