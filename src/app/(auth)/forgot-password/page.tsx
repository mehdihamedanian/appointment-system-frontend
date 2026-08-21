import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { routes } from "@/constants/routes";

export const metadata = { title: "بازیابی رمز عبور" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="بازیابی رمز عبور"
      description="درخواست بازیابی در مرحله احراز هویت پیاده‌سازی می‌شود."
    >
      <p>
        <Link href={routes.auth.login}>بازگشت به ورود</Link>
      </p>
    </AuthShell>
  );
}
