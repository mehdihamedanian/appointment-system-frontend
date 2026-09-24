"use client";

import { useEffect } from "react";
import { cycleTab, focusFirst } from "@/lib/accessibility/focus";

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const previousPaddingInlineEnd = body.style.paddingInlineEnd;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingInlineEnd = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      body.style.paddingInlineEnd = previousPaddingInlineEnd;
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
    /** Prefer this element when the trap activates; falls back to first focusable. */
    initialFocus?: () => HTMLElement | null;
  } = {},
): void {
  const { onEscape, preventClose = false, restoreFocus = true, initialFocus } = options;

  useEffect(() => {
    if (!active) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    let cancelled = false;
    let focusFrame = 0;

    function tryFocusRoot() {
      if (cancelled) return;
      const root = getRoot();
      if (root) {
        const preferred = initialFocus?.();
        if (preferred && root.contains(preferred)) {
          preferred.focus();
        } else {
          const safe = root.querySelector<HTMLElement>("[data-confirm-safe-action]");
          if (safe) {
            safe.focus();
          } else {
            focusFirst(root);
          }
        }
        return;
      }
      focusFrame = window.requestAnimationFrame(tryFocusRoot);
    }

    tryFocusRoot();

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
      cancelled = true;
      if (focusFrame) {
        window.cancelAnimationFrame(focusFrame);
      }
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocus) {
        previouslyFocused?.focus();
      }
    };
  }, [active, getRoot, onEscape, preventClose, restoreFocus, initialFocus]);
}
