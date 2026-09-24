"use client";

import { UnexpectedErrorState } from "@/components/feedback/app-states";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-main">
      <UnexpectedErrorState
        title="خطا در صفحه احراز هویت"
        onRetry={reset}
        detail={error.digest ?? error.message}
      />
    </div>
  );
}
