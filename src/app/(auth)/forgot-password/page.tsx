import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata = { title: "بازیابی رمز عبور" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="بازیابی رمز عبور"
      description="شماره موبایل حساب مشتری را وارد کنید."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
