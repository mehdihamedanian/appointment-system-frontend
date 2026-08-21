import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "لیست انتظار" };

export default function AdminWaitingListPage() {
  return (
    <RouteShell
      title="لیست انتظار"
      description="این ماژول اختیاری است و با قابلیت لیست انتظار مجموعه هم‌خوان می‌شود."
    />
  );
}
