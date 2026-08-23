import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bookingHref } from "@/lib/public/booking-href";
import type { PublicBusiness } from "@/types/public";

export function FinalCta({ business }: { business: PublicBusiness }) {
  if (!business.bookingEnabled) {
    return (
      <section className="public-final-cta" aria-labelledby="final-cta-title">
        <h2 id="final-cta-title">رزرو آنلاین فعال نیست</h2>
        <p>برای هماهنگی نوبت، از بخش تماس استفاده کنید.</p>
        <Button asChild variant="secondary">
          <Link href="#contact">مشاهده راه‌های تماس</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="public-final-cta" aria-labelledby="final-cta-title">
      <h2 id="final-cta-title">آماده رزرو هستید؟</h2>
      <p>نوبت خود را برای همین مجموعه ثبت کنید.</p>
      <Button asChild>
        <Link href={bookingHref()}>شروع رزرو</Link>
      </Button>
    </section>
  );
}
