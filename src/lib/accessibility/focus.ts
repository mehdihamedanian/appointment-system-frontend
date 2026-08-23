import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function focusFirst(root: HTMLElement): void {
  const items = getFocusable(root);
  (items[0] ?? root).focus();
}

export function cycleTab(root: HTMLElement, event: KeyboardEvent): void {
  const items = getFocusable(root);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
