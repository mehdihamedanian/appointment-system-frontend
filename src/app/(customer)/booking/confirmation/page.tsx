import { redirect } from "next/navigation";
import { BookingConfirmationScreen } from "@/features/booking/booking-confirmation-screen";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";

export const metadata = {
  title: "تأیید رزرو",
  robots: { index: false, follow: false },
};

export default async function BookingConfirmationIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  if (params.ref && isSafePublicId(params.ref)) {
    redirect(routes.customer.bookingConfirmation(params.ref));
  }
  return <BookingConfirmationScreen reference="" />;
}
