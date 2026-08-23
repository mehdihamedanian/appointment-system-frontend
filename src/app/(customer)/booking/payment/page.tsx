import { Suspense } from "react";
import { PaymentScreen } from "@/features/booking/payment-screen";
import { Skeleton } from "@/components/feedback/loading-states";

export const metadata = {
  title: "پرداخت",
  robots: { index: false, follow: false },
};

export default function BookingPaymentPage() {
  return (
    <Suspense fallback={<Skeleton variant="card" />}>
      <PaymentScreen />
    </Suspense>
  );
}
