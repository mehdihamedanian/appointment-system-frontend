import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { sanitizeBranchId } from "@/lib/admin/dashboard-filters";
import type { PublicBusiness } from "@/types/public";

/** Multi-branch UI is shown only when capability and business flag agree. */
export function isAdminMultiBranchEnabled(
  business?: Pick<PublicBusiness, "branchesEnabled"> | null,
): boolean {
  return (
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    business?.branchesEnabled === true
  );
}

export function parseAdminBranchContext(searchParams: {
  get(name: string): string | null;
}): string | undefined {
  return sanitizeBranchId(searchParams.get("branch"));
}

export function adminPathWithBranch(pathname: string, branchId?: string): string {
  if (!branchId) return pathname;
  const url = new URL(pathname, "http://local");
  url.searchParams.set("branch", branchId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
