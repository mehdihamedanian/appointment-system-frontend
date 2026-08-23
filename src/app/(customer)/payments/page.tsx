import { Suspense } from "react";
import { PaymentsScreen } from "@/features/customer/payments-screen";
import { PaymentListSkeleton } from "@/features/customer/payment-list-skeleton";

export const metadata = {
  title: "پرداخت‌ها",
  robots: { index: false, follow: false },
};

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PaymentListSkeleton />}>
      <PaymentsScreen />
    </Suspense>
  );
}
