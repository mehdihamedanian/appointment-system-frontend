import { RouteShell } from "@/components/shared/route-shell";

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

  return (
    <RouteShell
      title="جزئیات نوبت"
      identity={appointmentId}
      description="جزئیات نوبت، وضعیت و اقدامات مرتبط در مرحله بعد پیاده‌سازی می‌شود."
    />
  );
}
