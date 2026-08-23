import { env } from "@/config/env";

const UNSAFE_PROTOCOL = /^(javascript:|data:|vbscript:)/i;

function allowlist(): string[] {
  return env.paymentGatewayOrigins;
}

function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

export function getSafeGatewayRedirect(
  candidate: string | null | undefined,
  origins: string[] = allowlist(),
): string | undefined {
  if (!candidate || typeof candidate !== "string") {
    return undefined;
  }
  const trimmed = candidate.trim();
  if (!trimmed || UNSAFE_PROTOCOL.test(trimmed)) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !(env.allowInsecureGatewayRedirect && isLocalHttp)) {
    return undefined;
  }
  const allowed = origins;
  if (allowed.length === 0) {
    return undefined;
  }
  const origin = originOf(parsed);
  if (!allowed.includes(origin)) {
    return undefined;
  }
  return parsed.toString();
}
