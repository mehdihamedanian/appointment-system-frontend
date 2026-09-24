import { AdminAppointmentRescheduleScreen } from "@/features/admin/admin-appointment-reschedule-screen";

export const metadata = { title: "تغییر زمان نوبت" };

export default async function AdminAppointmentReschedulePage({
  params,
}: {
  params: Promise<{ appointmentReference: string }>;
}) {
  const { appointmentReference } = await params;
  return <AdminAppointmentRescheduleScreen reference={appointmentReference} />;
}
