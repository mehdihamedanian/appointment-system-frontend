"use client";

import { useSyncExternalStore } from "react";
import {
  MEDIA_MAX_LG,
  MEDIA_MAX_MD,
  subscribeMedia,
  matchesMedia,
} from "@/lib/responsive/breakpoints";

function useMediaQuery(query: string, serverSnapshot = false): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeMedia(query, onChange),
    () => matchesMedia(query),
    () => serverSnapshot,
  );
}

/** True below the md breakpoint (customer mobile chrome / drawers). */
export function useIsMobileViewport(): boolean {
  return useMediaQuery(MEDIA_MAX_MD, false);
}

/** True below the lg breakpoint (admin hamburger / drawer). */
export function useIsAdminDrawerViewport(): boolean {
  return useMediaQuery(MEDIA_MAX_LG, false);
}
