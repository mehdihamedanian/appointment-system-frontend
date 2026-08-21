"use client";

import { UnexpectedErrorState } from "@/components/feedback/app-states";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <UnexpectedErrorState
      title="خطا در پنل مدیریت"
      onRetry={reset}
      detail={error.digest ?? error.message}
    />
  );
}
