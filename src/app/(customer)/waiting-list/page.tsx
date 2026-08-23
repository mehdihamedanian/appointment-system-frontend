import { Suspense } from "react";
import { WaitingListScreen } from "@/features/customer/waiting-list-screen";
import { WaitingListSkeleton } from "@/features/customer/waiting-list-skeleton";

export const metadata = {
  title: "لیست انتظار",
  robots: { index: false, follow: false },
};

export default function WaitingListPage() {
  return (
    <Suspense fallback={<WaitingListSkeleton />}>
      <WaitingListScreen />
    </Suspense>
  );
}
