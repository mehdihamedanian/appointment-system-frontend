import { env } from "@/config/env";
import { toLatinPhone } from "@/lib/utilities/digits";

export function telHref(phone: string): string | undefined {
  const digits = toLatinPhone(phone).replace(/[^\d+]/g, "");
  if (digits.length < 8) {
    return undefined;
  }
  return `tel:${digits}`;
}

export function mailtoHref(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed.includes("@") || trimmed.includes(" ")) {
    return undefined;
  }
  return `mailto:${trimmed}`;
}

export function directionsHref(address?: string, explicit?: string): string | undefined {
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      return undefined;
    }
  }
  if (!address?.trim()) {
    return undefined;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`;
}

export function canonicalSiteUrl(path = "/"): string | undefined {
  if (!env.siteUrl) {
    return undefined;
  }
  try {
    return new URL(path, env.siteUrl).toString();
  } catch {
    return undefined;
  }
}

export const EXTERNAL_LINK_REL = "noopener noreferrer";
