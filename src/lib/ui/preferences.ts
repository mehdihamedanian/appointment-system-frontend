/**
 * Safe UI preferences for non-sensitive presentation state.
 * Only booleans are stored; never tokens, PII, or permission payloads.
 */
const STORAGE_PREFIX = "appointment.ui.pref.v1.";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export function subscribeBooleanUiPreference(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function readBooleanUiPreference(key: string, fallback = false): boolean {
  if (!canUseStorage()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeBooleanUiPreference(key: string, value: boolean): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value ? "true" : "false");
    notify(key);
  } catch {
    // Quota / private mode — preference is best-effort only.
  }
}

export const ADMIN_SIDEBAR_COLLAPSED_PREF = "admin.sidebar.collapsed";
