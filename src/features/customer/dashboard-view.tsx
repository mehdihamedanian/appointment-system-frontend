import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { hasNoUpcomingAppointments } from "@/lib/customer/adapters";
import type { CustomerDashboardView } from "@/types/customer";
import { DashboardHeader } from "@/features/customer/dashboard-header";
import {
  NextAppointmentCard,
  UpcomingAppointmentRow,
} from "@/features/customer/next-appointment-card";
import { NoUpcomingState } from "@/features/customer/no-upcoming-state";
import { NotificationPreviewList } from "@/features/customer/notification-preview";
import { PaymentSummaryCard } from "@/features/customer/payment-summary-card";
import { PendingActionCard } from "@/features/customer/pending-action-card";
import { QuickActions } from "@/features/customer/quick-actions";
import { RecentActivityList } from "@/features/customer/recent-activity";
import { WidgetError } from "@/features/customer/widget-error";

export function DashboardView({
  view,
  bookingEnabled,
  phone,
  onRetry,
}: {
  view: CustomerDashboardView;
  bookingEnabled: boolean;
  phone?: string;
  onRetry: () => void;
}) {
  const empty = hasNoUpcomingAppointments(view);
  const appointmentsWidget = view.widgets.appointments;
  const notificationsWidget = view.widgets.notifications;
  const paymentsWidget = view.widgets.payments;
  const appointmentsFailed = appointmentsWidget?.status === "error";
  const upcomingPreview = view.upcomingAppointments.filter(
    (item) => item.id !== view.nextAppointment?.id,
  );
  const showPayments = Boolean(view.paymentSummary) && paymentsWidget?.status !== "error";

  return (
    <div className="customer-dashboard">
      <DashboardHeader
        displayName={view.customer.displayName}
        unreadCount={view.unreadNotificationCount}
        bookingEnabled={bookingEnabled}
      />

      <div className="customer-dashboard__layout">
        {appointmentsFailed && appointmentsWidget?.status === "error" ? (
          <div className="dash-next">
            <WidgetError
              title="نوبت‌ها دریافت نشد"
              requestId={appointmentsWidget.error.requestId}
              onRetry={onRetry}
            />
          </div>
        ) : empty ? (
          <div className="dash-next">
            <NoUpcomingState bookingEnabled={bookingEnabled} phone={phone} />
          </div>
        ) : (
          <>
            {view.nextAppointment ? (
              <div className="dash-next">
                <NextAppointmentCard appointment={view.nextAppointment} />
              </div>
            ) : null}
            {bookingEnabled ? (
              <div className="dash-cta">
                <Button asChild fullWidth>
                  <Link href={routes.customer.booking}>رزرو نوبت جدید</Link>
                </Button>
              </div>
            ) : (
              <div className="dash-booking-disabled">
                <Alert
                  tone="warning"
                  title="رزرو آنلاین فعال نیست"
                  description="در حال حاضر امکان ثبت نوبت جدید از این صفحه وجود ندارد."
                />
              </div>
            )}
          </>
        )}

        {view.pendingAction ? (
          <div className="dash-pending">
            <PendingActionCard action={view.pendingAction} />
          </div>
        ) : null}

        {!appointmentsFailed && !empty ? (
          <section className="dash-upcoming" aria-labelledby="upcoming-title">
            <div className="dashboard-widget-head">
              <h2 id="upcoming-title" className="text-card-title">
                نوبت‌های پیش‌رو
              </h2>
              <Link href={routes.customer.appointments}>مشاهده همه نوبت‌ها</Link>
            </div>
            {upcomingPreview.length > 0 ? (
              <ul className="dashboard-upcoming">
                {upcomingPreview.map((item) => (
                  <UpcomingAppointmentRow key={item.id} appointment={item} />
                ))}
              </ul>
            ) : (
              <p className="text-caption">نوبت دیگری در پیش نیست.</p>
            )}
          </section>
        ) : null}

        <div className="dash-notify">
          {notificationsWidget?.status === "error" ? (
            <WidgetError
              title="اعلان‌ها دریافت نشد"
              requestId={notificationsWidget.error.requestId}
              onRetry={onRetry}
            />
          ) : (
            <NotificationPreviewList
              unreadCount={view.unreadNotificationCount}
              notifications={view.recentNotifications}
            />
          )}
        </div>

        <div className="dash-pay">
          {paymentsWidget?.status === "error" ? (
            <WidgetError
              title="اطلاعات پرداخت دریافت نشد"
              requestId={paymentsWidget.error.requestId}
              onRetry={onRetry}
            />
          ) : view.paymentSummary ? (
            <PaymentSummaryCard summary={view.paymentSummary} />
          ) : null}
        </div>

        {view.recentActivities ? (
          <div className="dash-activity">
            <RecentActivityList activities={view.recentActivities} />
          </div>
        ) : null}

        <div className="dash-quick">
          <QuickActions
            bookingEnabled={bookingEnabled}
            showPayments={showPayments}
            phone={phone}
          />
        </div>
      </div>
    </div>
  );
}
