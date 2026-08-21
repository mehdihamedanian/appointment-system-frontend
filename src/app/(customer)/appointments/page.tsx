import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "نوبت‌ها" };

export default function AppointmentsPage() {
  return (
    <RouteShell
      title="نوبت‌های من"
      description="فهرست نوبت‌های مشتری در مرحله بعد به این صفحه متصل می‌شود."
    />
  );
}
