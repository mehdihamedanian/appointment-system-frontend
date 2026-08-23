import { Suspense } from "react";
import { NotificationsScreen } from "@/features/customer/notifications-screen";
import { NotificationListSkeleton } from "@/features/customer/notification-list-skeleton";

export const metadata = {
  title: "اعلان‌ها",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationListSkeleton />}>
      <NotificationsScreen />
    </Suspense>
  );
}
