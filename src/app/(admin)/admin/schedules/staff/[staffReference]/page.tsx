import { AdminScheduleStaffScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";

export default async function AdminScheduleStaffPage({
  params,
}: {
  params: Promise<{ staffReference: string }>;
}) {
  const { staffReference } = await params;
  return <AdminScheduleStaffScreen staffReference={staffReference} />;
}
