import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "شعب" };

export default function AdminBranchesPage() {
  return (
    <RouteShell
      title="شعب"
      description="این ماژول اختیاری است و نمایش آن به قابلیت چندشعبه بودن مجموعه وابسته خواهد بود."
    />
  );
}
