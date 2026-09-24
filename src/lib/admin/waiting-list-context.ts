import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import type { PublicBusiness } from "@/types/public";
import { ADMIN_WAITING_LIST_MANAGEMENT_ENABLED } from "@/types/admin-waiting-list";

/** Waiting-list admin UI when capability and business flag agree. */
export function isAdminWaitingListEnabled(
  business?: Pick<PublicBusiness, "waitingListEnabled"> | null,
): boolean {
  if (!ADMIN_WAITING_LIST_MANAGEMENT_ENABLED) return false;
  if (!isCapabilityVisible(getBusinessCapabilities(), "waitingList")) return false;
  return business?.waitingListEnabled !== false;
}
