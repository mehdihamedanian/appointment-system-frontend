import { PaymentDetailScreen } from "@/features/customer/payment-detail-screen";

export const metadata = {
  title: "جزئیات پرداخت",
  robots: { index: false, follow: false },
};

export default function PaymentDetailPage() {
  return <PaymentDetailScreen />;
}
