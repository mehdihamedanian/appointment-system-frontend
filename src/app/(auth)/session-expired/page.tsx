import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { SessionExpiredState } from "@/components/feedback/app-states";
import { SessionExpiredLoginLink } from "@/features/auth/session-expired-login-link";

export const metadata = { title: "نشست منقضی شده" };

export default function SessionExpiredPage() {
  return (
    <AuthShell
      title="نشست منقضی شده"
      description="برای ادامه باید دوباره وارد حساب شوید. نوبت یا رزرو قبلی پس از ورود لزوماً معتبر نمی‌ماند."
    >
      <SessionExpiredState
        description="نشست شما پایان یافته است. پس از ورود دوباره، وضعیت نوبت، پرداخت یا رزرو موقت را از نو بررسی کنید."
        action={
          <Suspense fallback={null}>
            <SessionExpiredLoginLink />
          </Suspense>
        }
      />
    </AuthShell>
  );
}
