import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { PageLoading } from "@/components/feedback/loading-states";
import { GuestGuard } from "@/features/auth/guards";
import { ACCESS_COOKIE, SESSION_COOKIE } from "@/lib/server/backend-session";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const signedOut = !cookieStore.has(SESSION_COOKIE) && !cookieStore.has(ACCESS_COOKIE);

  return (
    <main id="main-content" tabIndex={-1}>
      <Suspense fallback={<PageLoading label="در حال آماده‌سازی ورود" />}>
        <GuestGuard signedOut={signedOut}>{children}</GuestGuard>
      </Suspense>
    </main>
  );
}
