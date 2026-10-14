import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { validateProductionEnv } from "./src/config/production-env";

function hostnameFrom(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname;
  } catch {
    return undefined;
  }
}

function assertProductionEnv() {
  const { errors, warnings } = validateProductionEnv(process.env);
  for (const warning of warnings) {
    console.warn(`⚠ env: ${warning}`);
  }
  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}

const mediaHosts = Array.from(
  new Set(
    [
      "localhost",
      hostnameFrom(process.env.NEXT_PUBLIC_API_BASE_URL),
      hostnameFrom(process.env.NEXT_PUBLIC_SITE_URL),
      hostnameFrom(process.env.NEXT_PUBLIC_MEDIA_HOST),
    ].filter((value): value is string => Boolean(value)),
  ),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: mediaHosts.flatMap((hostname) => [
      { protocol: "https", hostname, pathname: "/**" },
      { protocol: "http", hostname, pathname: "/**" },
    ]),
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    assertProductionEnv();
  }
  return nextConfig;
}
