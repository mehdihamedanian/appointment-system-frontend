import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { routes } from "@/constants/routes";

export const metadata = { title: "ثبت‌نام" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="ایجاد حساب"
      description="ثبت‌نام مشتری در مرحله احراز هویت پیاده‌سازی می‌شود."
    >
      <p>
        حساب دارید؟ <Link href={routes.auth.login}>وارد شوید</Link>
      </p>
    </AuthShell>
  );
}
