"use client";

import { useEffect, useRef } from "react";
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
  const { restoreFocus = true } = options;
  // Callers usually pass inline callbacks; re-running the trap on every render
  // would move focus out of the field the user is typing in.
  const latest = useRef({ ...options, getRoot });
  useEffect(() => {
    latest.current = { ...options, getRoot };
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    const resolveRoot = () => latest.current.getRoot();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    let cancelled = false;
    let focusFrame = 0;

    function tryFocusRoot() {
      if (cancelled) return;
      const root = resolveRoot();
      if (root) {
        const preferred = latest.current.initialFocus?.();
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
      const current = resolveRoot();
      if (event.key === "Escape" && !latest.current.preventClose) {
        event.preventDefault();
        latest.current.onEscape?.();
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
      if (restoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active, restoreFocus]);
}
