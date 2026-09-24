import { AdminScheduleBranchScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";

export default async function AdminScheduleBranchPage({
  params,
}: {
  params: Promise<{ branchReference: string }>;
}) {
  const { branchReference } = await params;
  return <AdminScheduleBranchScreen branchReference={branchReference} />;
}
