import Link from "next/link";
import { NotFoundState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export default function CustomerNotFound() {
  return (
    <div className="customer-main">
      <NotFoundState
        title="صفحه پیدا نشد"
        description="آدرس ممکن است اشتباه باشد یا این بخش دیگر در دسترس نباشد."
        action={
          <Button asChild variant="secondary">
            <Link href={routes.customer.dashboard}>بازگشت به داشبورد</Link>
          </Button>
        }
      />
    </div>
  );
}
