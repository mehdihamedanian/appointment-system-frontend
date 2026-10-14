import { ClientOnly } from "@/components/feedback/client-only";
import { PageLoading } from "@/components/feedback/loading-states";
import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata = { title: "رمز عبور جدید" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="تنظیم رمز عبور جدید"
      description="رمز عبور جدید را وارد کنید."
    >
      <ClientOnly fallback={<PageLoading />}>
        <ResetPasswordForm />
      </ClientOnly>
    </AuthShell>
  );
}
