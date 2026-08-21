import { AuthShell } from "@/components/layout/auth-shell";

export const metadata = { title: "تنظیم رمز عبور" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="تنظیم رمز عبور جدید"
      description="فرم تنظیم رمز در مرحله احراز هویت پیاده‌سازی می‌شود."
    >
      <p>پس از تأیید پیوند بازیابی، رمز جدید اینجا تنظیم می‌شود.</p>
    </AuthShell>
  );
}
