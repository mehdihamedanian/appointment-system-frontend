import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "رویدادها" };

export default function AdminActivityLogsPage() {
  return (
    <RouteShell
      title="رویدادها"
      description="سوابق فعالیت پس از تعریف قرارداد API در این صفحه نمایش داده می‌شود."
    />
  );
}
