import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "نوبت‌ها" };

export default function AdminAppointmentsPage() {
  return (
    <RouteShell
      title="مدیریت نوبت‌ها"
      description="فهرست عملیاتی نوبت‌ها در مرحله بعد پیاده‌سازی می‌شود."
    />
  );
}
