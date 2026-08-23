import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata = { title: "رمز عبور جدید" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="تنظیم رمز عبور جدید"
      description="رمز عبور جدید را وارد کنید."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
