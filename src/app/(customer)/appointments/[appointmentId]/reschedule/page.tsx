import { AppointmentRescheduleScreen } from "@/features/customer/appointment-reschedule-screen";

type AppointmentReschedulePageProps = {
  params: Promise<{ appointmentId: string }>;
};

export async function generateMetadata({ params }: AppointmentReschedulePageProps) {
  const { appointmentId } = await params;
  return { title: `زمان‌بندی مجدد ${appointmentId}` };
}

export default async function AppointmentReschedulePage({
  params,
}: AppointmentReschedulePageProps) {
  const { appointmentId } = await params;

  return <AppointmentRescheduleScreen reference={appointmentId} />;
}
