import { Skeleton } from "@/components/feedback/loading-states";

export function PublicHomeSkeleton() {
  return (
    <div className="public-home" aria-busy="true" aria-live="polite" aria-label="در حال بارگذاری صفحه مجموعه">
      <div className="public-hero">
        <div className="public-hero__copy">
          <Skeleton variant="title" />
          <Skeleton variant="line" />
          <Skeleton variant="line-short" />
        </div>
        <Skeleton variant="rect" />
      </div>
      <div className="public-card-grid">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
