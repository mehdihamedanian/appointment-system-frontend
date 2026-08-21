import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "پرداخت‌ها" };

export default function PaymentsPage() {
  return (
    <RouteShell
      title="پرداخت‌ها"
      description="سوابق پرداخت در صورت فعال بودن این قابلیت از قرارداد Backend خوانده می‌شود."
    />
  );
}
