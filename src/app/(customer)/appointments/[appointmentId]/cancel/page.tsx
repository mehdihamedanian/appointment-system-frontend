import { AppointmentCancellationScreen } from "@/features/customer/appointment-cancellation-screen";

type AppointmentCancelPageProps = {
  params: Promise<{ appointmentId: string }>;
};

export async function generateMetadata({ params }: AppointmentCancelPageProps) {
  const { appointmentId } = await params;
  return { title: `لغو نوبت ${appointmentId}` };
}

export default async function AppointmentCancelPage({
  params,
}: AppointmentCancelPageProps) {
  const { appointmentId } = await params;

  return <AppointmentCancellationScreen reference={appointmentId} />;
}
