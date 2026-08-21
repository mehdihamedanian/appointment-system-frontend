import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "تنظیمات" };

export default function AdminSettingsPage() {
  return (
    <RouteShell
      title="تنظیمات"
      description="تنظیمات این مجموعه در مرحله بعد به این صفحه متصل می‌شود."
    />
  );
}
