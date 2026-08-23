import { SlotHoldScreen } from "@/features/booking/slot-hold-screen";
import { isSafePublicId } from "@/lib/public/booking-href";

type PageProps = {
  params: Promise<{ holdReference: string }>;
};

export const metadata = {
  title: "رزرو موقت",
  robots: { index: false, follow: false },
};

export default async function BookingHoldPage({ params }: PageProps) {
  const { holdReference } = await params;
  const reference = isSafePublicId(holdReference) ? holdReference : "";
  return <SlotHoldScreen reference={reference} />;
}
