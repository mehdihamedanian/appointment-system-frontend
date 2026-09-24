/**
 * Canonical responsive breakpoints for JS (Phase 43).
 * Keep aligned with `src/styles/tokens.css` — do not invent a second system.
 *
 * CSS media queries should use the same pixel/rem values:
 * - sm: 480px / 30rem
 * - md: 768px / 48rem  (customer/public chrome, booking wizard)
 * - lg: 1024px / 64rem (admin sidebar, admin table↔card dual layouts)
 * - xl: 1280px / 80rem
 */

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/** max-width query for “below md” (mobile customer chrome). */
export const MEDIA_MAX_MD = `(max-width: ${BREAKPOINTS.md - 1}px)`;

/** min-width query for md and up. */
export const MEDIA_MIN_MD = `(min-width: ${BREAKPOINTS.md}px)`;

/** max-width query for “below lg” (admin drawer mode). */
export const MEDIA_MAX_LG = `(max-width: ${BREAKPOINTS.lg - 1}px)`;

/** min-width query for lg and up. */
export const MEDIA_MIN_LG = `(min-width: ${BREAKPOINTS.lg}px)`;

export function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function subscribeMedia(query: string, onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function isMobileViewport(): boolean {
  return matchesMedia(MEDIA_MAX_MD);
}

export function isAdminDrawerViewport(): boolean {
  return matchesMedia(MEDIA_MAX_LG);
}
