"use client";

import { useEffect } from "react";
import { cycleTab, focusFirst } from "@/lib/accessibility/focus";

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

export function useFocusTrap(
  active: boolean,
  getRoot: () => HTMLElement | null,
  options: {
    onEscape?: () => void;
    preventClose?: boolean;
    restoreFocus?: boolean;
  } = {},
): void {
  const { onEscape, preventClose = false, restoreFocus = true } = options;

  useEffect(() => {
    if (!active) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = getRoot();
    if (root) {
      focusFirst(root);
    }

    function onKeyDown(event: KeyboardEvent) {
      const current = getRoot();
      if (event.key === "Escape" && !preventClose) {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key === "Tab" && current) {
        cycleTab(current, event);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocus) {
        previouslyFocused?.focus();
      }
    };
  }, [active, getRoot, onEscape, preventClose, restoreFocus]);
}
