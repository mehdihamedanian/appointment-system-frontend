import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bookingHref } from "@/lib/public/booking-href";

export function StickyBookingCta({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null;
  }

  return (
    <div className="public-sticky-cta">
      <Button asChild fullWidth>
        <Link href={bookingHref()}>رزرو نوبت</Link>
      </Button>
    </div>
  );
}
