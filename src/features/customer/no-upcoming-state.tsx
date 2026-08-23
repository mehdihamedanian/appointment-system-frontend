import Link from "next/link";
import { EmptyState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { telHref } from "@/lib/public/links";

export function NoUpcomingState({
  bookingEnabled,
  phone,
}: {
  bookingEnabled: boolean;
  phone?: string;
}) {
  const tel = phone ? telHref(phone) : undefined;

  if (!bookingEnabled) {
    return (
      <EmptyState
        title="رزرو آنلاین فعال نیست"
        description="در حال حاضر نمی‌توانید از این صفحه نوبت جدید ثبت کنید. در صورت نیاز با مجموعه تماس بگیرید."
        action={
          tel ? (
            <Button asChild variant="secondary">
              <a href={tel}>تماس با مجموعه</a>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href="/#contact">راه‌های تماس</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <EmptyState
      title="نوبت پیش‌رویی ندارید"
      description="برای گرفتن نوبت جدید، خدمت موردنظر را انتخاب کنید."
      action={
        <Button asChild>
          <Link href={routes.customer.booking}>رزرو نوبت جدید</Link>
        </Button>
      }
      secondaryAction={
        tel ? (
          <Button asChild variant="ghost">
            <a href={tel}>تماس با مجموعه</a>
          </Button>
        ) : null
      }
    />
  );
}
