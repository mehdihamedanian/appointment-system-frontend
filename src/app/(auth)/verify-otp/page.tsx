import { AuthShell } from "@/components/layout/auth-shell";

export const metadata = { title: "تأیید کد" };

export default function VerifyOtpPage() {
  return (
    <AuthShell
      title="تأیید کد یک‌بارمصرف"
      description="ورود کد تأیید در مرحله احراز هویت پیاده‌سازی می‌شود."
    >
      <p>کد را در کادر بعدی وارد خواهید کرد.</p>
    </AuthShell>
  );
}
