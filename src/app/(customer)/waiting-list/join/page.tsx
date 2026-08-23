import { Suspense } from "react";
import { WaitingListJoinScreen } from "@/features/customer/waiting-list-join-screen";
import { WaitingListSkeleton } from "@/features/customer/waiting-list-skeleton";

export const metadata = {
  title: "پیوستن به لیست انتظار",
  robots: { index: false, follow: false },
};

export default function WaitingListJoinPage() {
  return (
    <Suspense fallback={<WaitingListSkeleton />}>
      <WaitingListJoinScreen />
    </Suspense>
  );
}
