import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "داشبورد" };

export default function DashboardPage() {
  return (
    <RouteShell
      title="داشبورد"
      description="نوبت‌های پیش‌رو و میانبرهای حساب در مرحله بعد به این صفحه اضافه می‌شود."
    />
  );
}
