import Link from "next/link";
import { env } from "@/config/env";
import { CalendarDays } from "lucide-react";
import { PublicImage } from "@/features/public/public-image";

export function Brand({
  compact = false,
  name,
  tagline,
  logoSrc,
}: {
  compact?: boolean;
  name?: string;
  tagline?: string;
  logoSrc?: string;
} = {}) {
  const displayName = name ?? env.appName;
  const displayTagline = tagline ?? env.appTagline;

  return (
    <Link href="/" className="brand">
      {logoSrc ? (
        <span className="brand__mark brand__mark--image">
          <PublicImage
            src={logoSrc}
            alt=""
            width={36}
            height={36}
            sizes="36px"
          />
        </span>
      ) : (
        <span className="brand__mark" aria-hidden="true">
          <CalendarDays size={20} />
        </span>
      )}
      <span className="brand__copy">
        <span className="brand__name">{displayName}</span>
        {compact ? null : (
          <span className="brand__tagline">{displayTagline}</span>
        )}
      </span>
    </Link>
  );
}
