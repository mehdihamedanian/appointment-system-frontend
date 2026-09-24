import { AdminAppointmentCancelScreen } from "@/features/admin/admin-appointment-cancel-screen";

export const metadata = { title: "لغو نوبت" };

export default async function AdminAppointmentCancelPage({
  params,
}: {
  params: Promise<{ appointmentReference: string }>;
}) {
  const { appointmentReference } = await params;
  return <AdminAppointmentCancelScreen reference={appointmentReference} />;
}
