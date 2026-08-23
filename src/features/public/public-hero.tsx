import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicImage } from "@/features/public/public-image";
import { bookingHref } from "@/lib/public/booking-href";
import type { PublicBusiness } from "@/types/public";

export function PublicHero({ business }: { business: PublicBusiness }) {
  const booking = business.bookingEnabled ? bookingHref() : undefined;

  return (
    <section className={business.heroImageUrl ? "public-hero has-media" : "public-hero"} aria-labelledby="home-title">
      <div className="public-hero__copy">
        {business.logoUrl ? (
          <div className="public-hero__logo">
            <PublicImage src={business.logoUrl} alt="" width={56} height={56} sizes="56px" />
          </div>
        ) : null}
        <h1 id="home-title">{business.name}</h1>
        {business.tagline ? <p className="public-hero__tagline">{business.tagline}</p> : null}
        {business.shortDescription ? <p>{business.shortDescription}</p> : null}
        <div className="public-hero__actions">
          {booking ? (
            <Button asChild>
              <Link href={booking}>رزرو نوبت</Link>
            </Button>
          ) : (
            <p className="public-hero__disabled">رزرو آنلاین در حال حاضر فعال نیست. از راه‌های تماس استفاده کنید.</p>
          )}
          <Button asChild variant="secondary">
            <Link href="#services">مشاهده خدمات</Link>
          </Button>
        </div>
      </div>
      {business.heroImageUrl ? (
        <div className="public-hero__media">
          <PublicImage
            src={business.heroImageUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 720px) 100vw, 40vw"
          />
        </div>
      ) : null}
    </section>
  );
}
