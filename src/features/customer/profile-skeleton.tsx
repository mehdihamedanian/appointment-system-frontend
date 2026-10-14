import { Skeleton } from "@/components/feedback/loading-states";

export function ProfileSkeleton({ label = "در حال بارگذاری حساب کاربری" }: { label?: string }) {
  return (
    <div className="profile-page" role="status" aria-busy="true" aria-label={label}>
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
