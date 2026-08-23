import Link from "next/link";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export function DashboardHeader({
  displayName,
  unreadCount,
  bookingEnabled,
}: {
  displayName: string;
  unreadCount: number;
  bookingEnabled: boolean;
}) {
  const unreadLabel =
    unreadCount > 0 ? `${unreadCount} اعلان خوانده‌نشده` : "اعلان‌ها";

  return (
    <header className="dashboard-header">
      <div className="dashboard-header__copy">
        <p className="dashboard-header__hello">سلام</p>
        <h1 className="dashboard-header__name">{displayName}</h1>
      </div>
      <div className="dashboard-header__actions">
        <Link href={routes.customer.notifications} className="icon-btn" aria-label={unreadLabel}>
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="dashboard-unread" aria-hidden="true">
              {unreadCount > 9 ? "۹+" : unreadCount}
            </span>
          ) : null}
        </Link>
        <Link href={routes.customer.profile} className="icon-btn" aria-label="حساب کاربری">
          <User size={20} aria-hidden="true" />
        </Link>
        {bookingEnabled ? (
          <Button asChild>
            <Link href={routes.customer.booking}>رزرو نوبت جدید</Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
