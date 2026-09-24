import Link from "next/link";
import { NotFoundState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export default function AdminNotFound() {
  return (
    <div className="admin-main">
      <NotFoundState
        title="صفحه مدیریت پیدا نشد"
        description="آدرس ممکن است اشتباه باشد یا این بخش حذف شده باشد."
        action={
          <Button asChild variant="secondary">
            <Link href={routes.admin.home}>بازگشت به پنل</Link>
          </Button>
        }
      />
    </div>
  );
}
