import { Suspense } from "react";
import { PageLoading } from "@/components/feedback/loading-states";
import { BookingWizard } from "@/features/booking/booking-wizard";

export const metadata = { title: "رزرو نوبت" };

export default function BookingPage() {
  return (
    <Suspense fallback={<PageLoading label="در حال آماده‌سازی رزرو" />}>
      <BookingWizard />
    </Suspense>
  );
}
