import { ClientOnly } from "@/components/feedback/client-only";
import { PageLoading } from "@/components/feedback/loading-states";
import { AuthShell } from "@/components/layout/auth-shell";
import { VerifyOtpForm } from "@/features/auth/verify-otp-form";

export const metadata = { title: "تأیید کد" };

export default function VerifyOtpPage() {
  return (
    <AuthShell
      title="تأیید شماره موبایل"
      description="کد پیامک‌شده را وارد کنید."
    >
      <ClientOnly fallback={<PageLoading />}>
        <VerifyOtpForm />
      </ClientOnly>
    </AuthShell>
  );
}
