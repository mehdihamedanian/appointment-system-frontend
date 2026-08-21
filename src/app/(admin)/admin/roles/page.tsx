import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "نقش‌ها" };

export default function AdminRolesPage() {
  return (
    <RouteShell
      title="نقش‌ها"
      description="نام نقش‌ها و مجوزها از Backend می‌آید و در این فاز جعل نمی‌شود."
    />
  );
}
