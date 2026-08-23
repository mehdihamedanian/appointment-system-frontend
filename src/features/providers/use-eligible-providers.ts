"use client";

import { useQuery } from "@tanstack/react-query";
import { eligibleProvidersQueryOptions } from "@/lib/api/providers";
import { isSafePublicId } from "@/lib/public/booking-href";

export function useEligibleProviders(input: {
  serviceId?: string;
  branchId?: string;
  enabled?: boolean;
}) {
  const serviceId = input.serviceId && isSafePublicId(input.serviceId) ? input.serviceId : undefined;
  const branchId = input.branchId && isSafePublicId(input.branchId) ? input.branchId : undefined;
  const enabled = Boolean(serviceId) && input.enabled !== false;

  return useQuery({
    ...eligibleProvidersQueryOptions(serviceId ?? "pending", branchId),
    enabled,
  });
}
