import { AuthShell } from "@/components/layout/auth-shell";
import { CustomerRegisterForm } from "@/features/auth/customer-register-form";

export const metadata = { title: "ثبت‌نام" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="ایجاد حساب مشتری"
      description="ثبت‌نام فقط برای مشتریان این کسب‌وکار است."
    >
      <CustomerRegisterForm />
    </AuthShell>
  );
}
