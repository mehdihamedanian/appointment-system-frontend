export function Skeleton({
  variant = "line",
}: {
  variant?: "title" | "line" | "line-short" | "card";
}) {
  return (
    <span
      className={`skeleton skeleton--${variant}`}
      aria-hidden="true"
    />
  );
}

export function PageLoading({ label = "در حال بارگذاری" }: { label?: string }) {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label={label}>
      <Skeleton variant="title" />
      <Skeleton variant="line" />
      <Skeleton variant="line-short" />
      <Skeleton variant="card" />
    </div>
  );
}

export function InlineLoading({ label = "در حال بارگذاری" }: { label?: string }) {
  return (
    <div className="inline-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
