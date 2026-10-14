import { Skeleton } from "@/components/feedback/loading-states";

export function ServicesCatalogSkeleton() {
  return (
    <div className="services-page" role="status" aria-busy="true" aria-label="در حال بارگذاری خدمات">
      <Skeleton variant="title" />
      <Skeleton variant="line-short" />
      <div className="public-card-grid">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}

export function ServiceDetailSkeleton() {
  return (
    <div className="service-detail" role="status" aria-busy="true" aria-label="در حال بارگذاری خدمت">
      <Skeleton variant="title" />
      <Skeleton variant="line" />
      <Skeleton variant="card" />
    </div>
  );
}
