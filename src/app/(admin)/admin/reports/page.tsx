import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "گزارش‌ها" };

export default function AdminReportsPage() {
  return (
    <RouteShell
      title="گزارش‌ها"
      description="گزارش‌های عملیاتی در فازهای بعد و بدون داده نمایشی در این مرحله اضافه می‌شوند."
    />
  );
}
