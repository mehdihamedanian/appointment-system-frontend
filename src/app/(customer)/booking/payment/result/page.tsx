import { Suspense } from "react";
import { PaymentResultScreen } from "@/features/booking/payment-result-screen";
import { Skeleton } from "@/components/feedback/loading-states";

export const metadata = {
  title: "نتیجه پرداخت",
  robots: { index: false, follow: false },
};

export default function BookingPaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" aria-label="در حال بررسی پرداخت">
          <Skeleton variant="card" />
        </div>
      }
    >
      <PaymentResultScreen />
    </Suspense>
  );
}
