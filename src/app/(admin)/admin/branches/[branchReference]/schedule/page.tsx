import { AdminScheduleBranchScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";

export const metadata = { title: "زمان‌بندی شعبه" };

export default async function AdminBranchSchedulePage({
  params,
}: {
  params: Promise<{ branchReference: string }>;
}) {
  const { branchReference } = await params;
  return <AdminScheduleBranchScreen branchReference={branchReference} />;
}
