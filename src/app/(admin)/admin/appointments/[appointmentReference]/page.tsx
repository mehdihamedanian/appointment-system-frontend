import { AdminAppointmentDetailScreen } from "@/features/admin/admin-appointment-detail-screen";

export const metadata = { title: "جزئیات نوبت" };

export default async function AdminAppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentReference: string }>;
}) {
  const { appointmentReference } = await params;
  return <AdminAppointmentDetailScreen reference={appointmentReference} />;
}
