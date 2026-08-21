import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { routes } from "@/constants/routes";

export const metadata = { title: "ورود" };

export default function LoginPage() {
  return (
    <AuthShell
      title="ورود به حساب"
      description="فرم ورود در مرحله احراز هویت پیاده‌سازی می‌شود."
    >
      <p>
        <Link href={routes.auth.forgotPassword}>بازیابی رمز عبور</Link>
        {" · "}
        <Link href={routes.auth.register}>ایجاد حساب</Link>
      </p>
    </AuthShell>
  );
}
