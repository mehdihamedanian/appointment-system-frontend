import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import type { PublicBusiness } from "@/types/public";
import { ADMIN_COUPON_MANAGEMENT_ENABLED } from "@/types/admin-coupon";

/** Coupon admin UI when capability and business flag agree. */
export function isAdminCouponsEnabled(
  business?: Pick<PublicBusiness, "couponsEnabled"> | null,
): boolean {
  if (!ADMIN_COUPON_MANAGEMENT_ENABLED) return false;
  if (!isCapabilityVisible(getBusinessCapabilities(), "coupons")) return false;
  return business?.couponsEnabled !== false;
}
