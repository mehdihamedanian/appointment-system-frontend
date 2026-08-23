import Image from "next/image";
import { resolveMediaUrl, shouldOptimizeImage } from "@/lib/public/media";

export function PublicImage({
  src,
  alt,
  priority = false,
  sizes,
  className,
  fill = false,
  width,
  height,
  onError,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  onError?: () => void;
}) {
  const resolved = resolveMediaUrl(src) ?? src;
  const optimized = shouldOptimizeImage(resolved);

  if (fill) {
    return (
      <Image
        src={resolved}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        className={className}
        priority={priority}
        unoptimized={!optimized}
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={width ?? 640}
      height={height ?? 480}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={!optimized}
      onError={onError}
    />
  );
}
