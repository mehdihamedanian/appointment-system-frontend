"use client";

import { useRouter } from "next/navigation";
import { ApiErrorState } from "@/components/feedback/app-states";

export function RetryApiError({
  title,
  description,
  requestId,
}: {
  title: string;
  description?: string;
  requestId?: string;
}) {
  const router = useRouter();
  return (
    <ApiErrorState
      title={title}
      description={description}
      requestId={requestId}
      onRetry={() => router.refresh()}
    />
  );
}
