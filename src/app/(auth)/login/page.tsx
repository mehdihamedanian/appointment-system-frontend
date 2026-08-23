import { AuthShell } from "@/components/layout/auth-shell";
import { CustomerLoginForm } from "@/features/auth/customer-login-form";

export const metadata = { title: "ورود" };

export default function LoginPage() {
  return (
    <AuthShell
      title="ورود به حساب"
      description="برای رزرو و مدیریت نوبت، وارد حساب مشتری شوید."
    >
      <CustomerLoginForm />
    </AuthShell>
  );
}
