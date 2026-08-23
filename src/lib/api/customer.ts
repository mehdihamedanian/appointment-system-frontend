import { apiClient } from "@/lib/api/client";
import { adaptCustomerDashboard } from "@/lib/customer/adapters";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { CustomerDashboardView } from "@/types/customer";

export async function fetchCustomerDashboard(
  signal?: AbortSignal,
): Promise<CustomerDashboardView> {
  const payload = await apiClient<unknown>("/customer/dashboard", {
    method: "GET",
    signal,
  });
  return adaptCustomerDashboard(payload);
}

export function invalidateCustomerDashboard(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.customer.dashboard(userId) });
}

export function customerDashboardQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.customer.dashboard(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCustomerDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  };
}
