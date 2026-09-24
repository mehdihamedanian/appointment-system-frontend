"use client";

import { UnexpectedErrorState } from "@/components/feedback/app-states";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="public-main">
      <UnexpectedErrorState
        title="خطا در صفحه عمومی"
        onRetry={reset}
        detail={error.digest ?? error.message}
      />
    </div>
  );
}
