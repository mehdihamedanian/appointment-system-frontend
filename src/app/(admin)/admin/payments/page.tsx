import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "پرداخت‌ها" };

export default function AdminPaymentsPage() {
  return (
    <RouteShell
      title="پرداخت‌ها"
      description="گزارش پرداخت‌ها در صورت فعال بودن این قابلیت از قرارداد Backend خوانده می‌شود."
    />
  );
}
