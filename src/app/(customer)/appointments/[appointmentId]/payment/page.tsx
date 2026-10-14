import { AppointmentPaymentScreen } from "@/features/customer/appointment-payment-screen";

type AppointmentPaymentPageProps = {
  params: Promise<{ appointmentId: string }>;
};

export const metadata = {
  title: "پرداخت نوبت",
  robots: { index: false, follow: false },
};

export default async function AppointmentPaymentPage({ params }: AppointmentPaymentPageProps) {
  const { appointmentId } = await params;

  return <AppointmentPaymentScreen reference={appointmentId} />;
}
