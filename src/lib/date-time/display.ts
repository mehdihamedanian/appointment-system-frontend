/**
 * Display helpers for mixed Persian/Latin values.
 * Calendar conversion and timezone policy belong to a later phase.
 */
export function displayDirFor(value: string): "ltr" | "auto" {
  return /[0-9A-Za-z]/.test(value) ? "ltr" : "auto";
}
