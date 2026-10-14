import { isRecord, readString } from "@/lib/utilities/records";

export function asSafeText(value: unknown): string | undefined {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }
  return raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").trim() || undefined;
}

export function unwrapPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }
  if (payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

export function asList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return [];
  }
  for (const key of keys) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
}

export function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["true", "yes", "1", "enabled", "active", "public"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "disabled", "inactive", "private", "hidden"].includes(normalized)) {
    return false;
  }
  return undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function readUrl(value: unknown): string | undefined {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith("/")) {
    // Browsers drop tabs/newlines and treat "\" as "/", so "/\host" or "/\t/host" resolve off-site.
    return /^\/[/\\]|[\\\u0000-\u001f]/.test(raw) ? undefined : raw;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}
