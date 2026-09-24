import { routes } from "@/constants/routes";
import type { AdminScheduleScope } from "@/types/admin-schedule";

export function adminScheduleHubHref(): string {
  return routes.admin.schedules;
}

export function adminScheduleBusinessHref(): string {
  return routes.admin.scheduleBusiness;
}

export function adminScheduleBranchHref(branchReference: string): string {
  return routes.admin.scheduleBranch(branchReference);
}

export function adminScheduleStaffHref(staffReference: string): string {
  return routes.admin.scheduleStaff(staffReference);
}

export function adminScheduleResourceHref(resourceReference: string): string {
  return routes.admin.scheduleResource(resourceReference);
}

export function adminScheduleHolidaysHref(): string {
  return routes.admin.scheduleHolidays;
}

export function adminScheduleHref(scope: AdminScheduleScope, reference?: string): string {
  switch (scope) {
    case "business":
      return adminScheduleBusinessHref();
    case "branch":
      return reference ? adminScheduleBranchHref(reference) : adminScheduleHubHref();
    case "staff":
      return reference ? adminScheduleStaffHref(reference) : adminScheduleHubHref();
    case "resource":
      return reference ? adminScheduleResourceHref(reference) : adminScheduleHubHref();
  }
}

export function adminScheduleApiPath(scope: AdminScheduleScope, reference?: string): string {
  switch (scope) {
    case "business":
      return "/admin/schedules/business";
    case "branch":
      return `/admin/schedules/branches/${encodeURIComponent(reference ?? "")}`;
    case "staff":
      return `/admin/schedules/staff/${encodeURIComponent(reference ?? "")}`;
    case "resource":
      return `/admin/schedules/resources/${encodeURIComponent(reference ?? "")}`;
  }
}

export function schedulePermissionForScope(
  scope: AdminScheduleScope,
  action: "view" | "edit" | "holidays" | "timeOff" | "blocks",
): string {
  const base = `admin.schedules.${scope}`;
  switch (action) {
    case "view":
      return `${base}.view`;
    case "edit":
      return `${base}.edit`;
    case "holidays":
      return "admin.schedules.holidays.manage";
    case "timeOff":
      return `${base}.time_off.manage`;
    case "blocks":
      return `${base}.blocks.manage`;
  }
}

export function parseScheduleScopeFromPath(pathname: string): {
  scope: AdminScheduleScope;
  reference?: string;
} | null {
  if (pathname === routes.admin.scheduleBusiness || pathname.endsWith("/schedules/business")) {
    return { scope: "business" };
  }
  const branchMatch = /\/admin\/schedules\/branches\/([^/]+)/.exec(pathname);
  if (branchMatch) return { scope: "branch", reference: decodeURIComponent(branchMatch[1]) };
  const staffMatch = /\/admin\/schedules\/staff\/([^/]+)/.exec(pathname);
  if (staffMatch) return { scope: "staff", reference: decodeURIComponent(staffMatch[1]) };
  const resourceMatch = /\/admin\/schedules\/resources\/([^/]+)/.exec(pathname);
  if (resourceMatch) return { scope: "resource", reference: decodeURIComponent(resourceMatch[1]) };
  if (pathname === routes.admin.scheduleHolidays || pathname.endsWith("/schedules/holidays")) {
    return { scope: "business" };
  }
  return null;
}
