import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "کاربران" };

export default function AdminUsersPage() {
  return (
    <RouteShell
      title="کاربران"
      description="مدیریت کاربران داخلی پس از مشخص شدن قرارداد نقش‌ها پیاده‌سازی می‌شود."
    />
  );
}
