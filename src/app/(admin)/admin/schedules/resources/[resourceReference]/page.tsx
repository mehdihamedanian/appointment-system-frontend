import { AdminScheduleResourceScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";

export default async function AdminScheduleResourcePage({
  params,
}: {
  params: Promise<{ resourceReference: string }>;
}) {
  const { resourceReference } = await params;
  return <AdminScheduleResourceScreen resourceReference={resourceReference} />;
}
