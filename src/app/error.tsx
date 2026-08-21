"use client";

import { UnexpectedErrorState } from "@/components/feedback/app-states";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="public-main">
      <UnexpectedErrorState
        onRetry={reset}
        detail={error.digest ?? error.message}
      />
    </div>
  );
}
