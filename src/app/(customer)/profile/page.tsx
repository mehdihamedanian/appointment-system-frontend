import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "حساب کاربری" };

export default function ProfilePage() {
  return (
    <RouteShell
      title="حساب کاربری"
      description="ویرایش مشخصات حساب در مرحله بعد به این صفحه اضافه می‌شود."
    />
  );
}
