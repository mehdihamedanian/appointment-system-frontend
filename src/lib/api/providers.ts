import { apiClient } from "@/lib/api/client";
import { isSafePublicId } from "@/lib/public/booking-href";
import { adaptEligibleProviders } from "@/lib/public/provider-adapters";
import { queryKeys } from "@/lib/query/keys";
import type { EligibleProvidersView } from "@/types/provider";

export async function fetchEligibleProviders(
  serviceId: string,
  branchId?: string,
  signal?: AbortSignal,
): Promise<EligibleProvidersView> {
  const payload = await apiClient<unknown>(
    `/public/services/${encodeURIComponent(serviceId)}/providers`,
    {
      method: "GET",
      signal,
      query: { branchId: branchId && isSafePublicId(branchId) ? branchId : undefined },
    },
  );
  return adaptEligibleProviders(payload);
}

export function eligibleProvidersQueryOptions(serviceId: string, branchId?: string) {
  return {
    queryKey: queryKeys.providers.byService(serviceId, branchId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchEligibleProviders(serviceId, branchId, signal),
    enabled: isSafePublicId(serviceId),
    staleTime: 15_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  };
}
