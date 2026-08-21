import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "تأیید رزرو" };

export default function BookingConfirmationPage() {
  return (
    <RouteShell
      title="تأیید رزرو"
      description="رسید رزرو و وضعیت تأیید بعد از اتصال به API در این صفحه نمایش داده می‌شود."
    />
  );
}
