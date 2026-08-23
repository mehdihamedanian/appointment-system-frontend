import type { NextConfig } from "next";

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
  images: {
    remotePatterns: mediaHosts.flatMap((hostname) => [
      { protocol: "https", hostname, pathname: "/**" },
      { protocol: "http", hostname, pathname: "/**" },
    ]),
  },
};

export default nextConfig;
