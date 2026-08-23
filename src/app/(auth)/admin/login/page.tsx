import { AuthShell } from "@/components/layout/auth-shell";
import { AdminLoginForm } from "@/features/auth/admin-login-form";

export const metadata = { title: "ورود مدیریت" };

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="ورود به پنل مدیریت"
      description="این صفحه فقط برای کارکنان مجاز همین کسب‌وکار است."
    >
      <AdminLoginForm />
    </AuthShell>
  );
}
