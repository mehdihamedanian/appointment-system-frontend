"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/accessibility/focus";

export function OverlayPortal({ children }: { children: ReactNode }) {
  const mounted = useIsClient();
  if (!mounted) {
    return null;
  }

  const target = document.getElementById("modal-portal") ?? document.body;
  return createPortal(children, target);
}
