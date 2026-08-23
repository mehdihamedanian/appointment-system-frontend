import { AppointmentDetailScreen } from "@/features/customer/appointment-detail-screen";

type AppointmentDetailPageProps = {
  params: Promise<{ appointmentId: string }>;
};

export async function generateMetadata({ params }: AppointmentDetailPageProps) {
  const { appointmentId } = await params;
  return { title: `نوبت ${appointmentId}` };
}

export default async function AppointmentDetailPage({
  params,
}: AppointmentDetailPageProps) {
  const { appointmentId } = await params;

  return <AppointmentDetailScreen reference={appointmentId} />;
}
