import { Suspense } from "react";
import { AppointmentsScreen } from "@/features/customer/appointments-screen";
import { AppointmentListSkeleton } from "@/features/customer/appointment-list-skeleton";

export const metadata = {
  title: "نوبت‌های من",
  robots: { index: false, follow: false },
};

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<AppointmentListSkeleton />}>
      <AppointmentsScreen />
    </Suspense>
  );
}
