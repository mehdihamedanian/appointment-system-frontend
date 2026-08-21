import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { SessionExpiredState } from "@/components/feedback/app-states";
import { routes } from "@/constants/routes";

export const metadata = { title: "نشست منقضی شده" };

export default function SessionExpiredPage() {
  return (
    <AuthShell
      title="نشست منقضی شده"
      description="برای ادامه باید دوباره وارد حساب شوید."
    >
      <SessionExpiredState
        action={
          <Link href={routes.auth.login} className="btn btn--primary">
            ورود دوباره
          </Link>
        }
      />
    </AuthShell>
  );
}
