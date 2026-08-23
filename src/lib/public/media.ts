import { env } from "@/config/env";

export function resolveMediaUrl(src?: string): string | undefined {
  if (!src) {
    return undefined;
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/") && env.apiBaseUrl) {
    try {
      return `${new URL(env.apiBaseUrl).origin}${src}`;
    } catch {
      return src;
    }
  }
  return src;
}

function isKnownHost(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    const allowed = [env.apiBaseUrl, env.siteUrl]
      .map((value) => {
        try {
          return value ? new URL(value.includes("://") ? value : `https://${value}`).hostname : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return host === "localhost" || allowed.includes(host);
  } catch {
    return false;
  }
}

export function shouldOptimizeImage(src: string): boolean {
  return src.startsWith("/") || isKnownHost(src);
}
