"use client";

import type { ReactNode } from "react";
import { useIsClient } from "@/lib/accessibility/focus";

/** Renders `children` only in the browser, for content that reads browser-only state while rendering. */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return useIsClient() ? children : fallback;
}
