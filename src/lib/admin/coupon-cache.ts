import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export function invalidateAdminCouponList(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: ["admin", "coupons", userId] });
}

export function invalidateAdminCouponDetail(
  queryClient: QueryClient,
  userId: string,
  reference: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.couponDetail(userId, reference),
  });
}

export function invalidateAfterAdminCouponMutation(
  queryClient: QueryClient,
  userId: string,
  reference?: string,
) {
  void invalidateAdminCouponList(queryClient, userId);
  if (reference) {
    void invalidateAdminCouponDetail(queryClient, userId, reference);
    void queryClient.invalidateQueries({
      queryKey: ["admin", "coupons", userId, "stats", reference],
    });
  }
  void queryClient.invalidateQueries({ queryKey: ["booking", "quote"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
}
