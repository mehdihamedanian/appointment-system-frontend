"use client";

import { useState } from "react";
import { ProviderSelector } from "@/features/providers/provider-selector";
import { useEligibleProviders } from "@/features/providers/use-eligible-providers";
import { toAppApiError } from "@/lib/api/errors";
import type { ProviderPreference, ProviderSelectionNotice } from "@/types/provider";

export function ProviderSelectionField({
  serviceId,
  branchId,
  value,
  onChange,
  submitted = false,
  disabled = false,
  contactHref,
}: {
  serviceId?: string;
  branchId?: string;
  value?: ProviderPreference;
  onChange: (value: ProviderPreference | undefined) => void;
  submitted?: boolean;
  disabled?: boolean;
  contactHref?: string;
}) {
  const [tracked, setTracked] = useState({ serviceId, branchId });
  const [notice, setNotice] = useState<ProviderSelectionNotice>();

  let contextChange: "service" | "branch" | "refresh" = "refresh";
  if (tracked.serviceId !== serviceId) {
    contextChange = "service";
  } else if (tracked.branchId !== branchId) {
    contextChange = "branch";
  }
  if (tracked.serviceId !== serviceId || tracked.branchId !== branchId) {
    setTracked({ serviceId, branchId });
    if (notice !== undefined) {
      setNotice(undefined);
    }
  }

  const query = useEligibleProviders({ serviceId, branchId });
  const loading = query.isPending && query.fetchStatus !== "idle";

  return (
    <ProviderSelector
      eligible={query.data}
      value={value}
      onChange={onChange}
      loading={loading}
      error={query.isError ? toAppApiError(query.error) : undefined}
      onRetry={() => {
        void query.refetch();
      }}
      disabled={disabled}
      submitted={submitted}
      contextChange={contextChange}
      notice={notice}
      onNotice={setNotice}
      contactHref={contactHref}
    />
  );
}
