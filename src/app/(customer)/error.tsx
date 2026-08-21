"use client";

import { UnexpectedErrorState } from "@/components/feedback/app-states";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <UnexpectedErrorState
      title="خطا در پنل مشتری"
      onRetry={reset}
      detail={error.digest ?? error.message}
    />
  );
}
