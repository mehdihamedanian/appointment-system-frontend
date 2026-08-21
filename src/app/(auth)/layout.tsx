import { Suspense, type ReactNode } from "react";
import { PageLoading } from "@/components/feedback/loading-states";
import { GuestGuard } from "@/features/auth/guards";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1}>
      <Suspense fallback={<PageLoading label="در حال آماده‌سازی ورود" />}>
        <GuestGuard>{children}</GuestGuard>
      </Suspense>
    </main>
  );
}
