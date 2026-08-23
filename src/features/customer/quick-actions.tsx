import Link from "next/link";
import { Bell, CalendarDays, Phone, Plus, User, Wallet } from "lucide-react";
import { routes } from "@/constants/routes";
import { telHref } from "@/lib/public/links";

export function QuickActions({
  bookingEnabled,
  showPayments,
  phone,
}: {
  bookingEnabled: boolean;
  showPayments: boolean;
  phone?: string;
}) {
  const tel = phone ? telHref(phone) : undefined;
  const secondary: Array<{ href: string; label: string; icon: typeof CalendarDays; external?: boolean }> = [
    {
      href: routes.customer.appointments,
      label: "نوبت‌های من",
      icon: CalendarDays,
    },
    {
      href: routes.customer.notifications,
      label: "اعلان‌ها",
      icon: Bell,
    },
    {
      href: routes.customer.profile,
      label: "حساب کاربری",
      icon: User,
    },
  ];
  if (showPayments) {
    secondary.push({
      href: routes.customer.payments,
      label: "پرداخت‌ها",
      icon: Wallet,
    });
  }
  if (tel) {
    secondary.push({ href: tel, label: "تماس با مجموعه", icon: Phone, external: true });
  } else {
    secondary.push({ href: "/#contact", label: "تماس با مجموعه", icon: Phone });
  }

  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="text-card-title">
        میانبرها
      </h2>
      <div className="dashboard-quick">
        {bookingEnabled ? (
          <Link href={routes.customer.booking} className="dashboard-quick__primary">
            <Plus size={18} aria-hidden="true" />
            رزرو نوبت جدید
          </Link>
        ) : null}
        {secondary.slice(0, 5).map((item) =>
          item.external ? (
            <a key={item.href} href={item.href} className="dashboard-quick__item">
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className="dashboard-quick__item">
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
