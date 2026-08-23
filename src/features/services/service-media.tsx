"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { PublicImage } from "@/features/public/public-image";

export function ServiceMedia({
  src,
  alt,
  priority = false,
  sizes,
  className = "public-card-media",
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={className}>
      {showImage && src ? (
        <PublicImage
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes ?? "(max-width: 720px) 100vw, (max-width: 960px) 50vw, 33vw"}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="service-media__fallback" aria-hidden={alt ? undefined : true}>
          <CalendarDays size={28} aria-hidden="true" />
          {alt && !src ? <span className="visually-hidden">{alt}</span> : null}
        </span>
      )}
    </div>
  );
}
