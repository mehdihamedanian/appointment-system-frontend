import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "پنل مدیریت" };

export default function AdminHomePage() {
  return (
    <RouteShell
      title="نمای کلی مدیریت"
      description="شاخص‌های عملیاتی واقعی پس از اتصال به API در این صفحه قرار می‌گیرند. در این مرحله داده نمایشی وجود ندارد."
    />
  );
}
