import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "کارکنان" };

export default function AdminStaffPage() {
  return (
    <RouteShell
      title="کارکنان"
      description="مدیریت کارکنان داخلی مجموعه در مرحله بعد پیاده‌سازی می‌شود."
    />
  );
}
