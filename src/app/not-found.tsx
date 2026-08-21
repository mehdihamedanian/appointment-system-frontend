import Link from "next/link";
import { EmptyState } from "@/components/feedback/app-states";
import { routes } from "@/constants/routes";

export default function NotFound() {
  return (
    <div className="public-main">
      <EmptyState
        title="صفحه پیدا نشد"
        description="آدرس واردشده در این سامانه وجود ندارد."
      />
      <p style={{ marginTop: "1rem" }}>
        <Link href={routes.public.home} className="btn btn--primary">
          بازگشت به خانه
        </Link>
      </p>
    </div>
  );
}
