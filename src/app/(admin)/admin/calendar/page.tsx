import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "تقویم" };

export default function AdminCalendarPage() {
  return (
    <>
      <RouteShell
        title="تقویم عملیاتی"
        description="رفتار نهایی تقویم در این فاز پیاده‌سازی نمی‌شود. این فقط محفظه چیدمان است."
      />
      <div className="calendar-foundation" aria-hidden="true" />
    </>
  );
}
