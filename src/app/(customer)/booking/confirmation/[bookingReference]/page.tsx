import { BookingConfirmationScreen } from "@/features/booking/booking-confirmation-screen";
import { isSafePublicId } from "@/lib/public/booking-href";

type PageProps = {
  params: Promise<{ bookingReference: string }>;
};

export const metadata = {
  title: "تأیید رزرو",
  robots: { index: false, follow: false },
};

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { bookingReference } = await params;
  const reference = isSafePublicId(bookingReference) ? bookingReference : "";
  return <BookingConfirmationScreen reference={reference} />;
}
